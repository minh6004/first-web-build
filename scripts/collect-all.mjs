#!/usr/bin/env node
// 이슈 브리핑 데이터 파이프라인 -- 실제 운영용 진입점.
// 1군(공식) 소스 DART/Fed/SEC/관세청(data.go.kr)/ECOS(한국은행)와 2군
// (비공식) 소스 GDELT/네이버뉴스를 전부 모아서 같은 정규화 스키마로
// 병합하고, 우선순위 상위 5~8건만 data/events/YYYY/MM/YYYY-MM-DD.json +
// data/latest.json에 저장한다.
//
// 2군 소스는 신뢰도가 낮아(reliability.tier: 2) AI 검수 게이트를 반드시
// 거친다: 그날 수집된 2군 후보 전체를 한 번의 배치 호출로 Haiku급 모델에
// 보내 승인/반려를 받고, 승인된 것만 needs_review를 false로 바꿔 최종
// 목록에 포함한다. 반려된 것은 발행하지 않고 data/rejected/에 사유와 함께
// 남긴다. 검수 프롬프트에는 이 스크립트의 생성 로직/추론을 전혀 넘기지
// 않고, 원본 증거와 생성된 카드 내용만 준다(scripts/review/gate.mjs).
//
// 사용법: node --env-file=.env scripts/collect-all.mjs [YYYY-MM-DD]
//   (또는 .env 없이 DART_API_KEY=발급받은키 ... node scripts/collect-all.mjs 로 인라인 전달해도 됨)
//   DART_API_KEY, DATA_GO_KR_API_KEY, ECOS_API_KEY, NCP_API_KEY_ID/
//   NCP_API_KEY, ANTHROPIC_API_KEY가 필요하다(Fed/SEC/GDELT는 공개 API라
//   키가 필요 없음). 프로젝트 루트의 .env.example을 복사해 .env를 만들고
//   실제 키를 채워 넣을 것 -- .env는 .gitignore에 이미 제외되어 있어
//   커밋되지 않는다.
//   날짜를 생략하면 오늘(KST) 날짜로 수집한다.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectDartEvents } from "./dart/collect.mjs";
import { collectFedEvents } from "./fed/collect.mjs";
import { collectSecEvents } from "./sec/collect.mjs";
import { collectCustomsEvents } from "./kdata/collect.mjs";
import { collectEcosEvents } from "./ecos/collect.mjs";
import { collectGdeltCandidates } from "./gdelt/collect.mjs";
import { collectNaverCandidates } from "./naver/collect.mjs";
import { reviewCandidates } from "./review/gate.mjs";
import { buildSummary } from "./lib/summary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const MAX_EVENTS = 8;
const MIN_EVENTS_TARGET = 5; // 참고용 -- 결과가 이보다 적어도 그대로 저장한다.

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function parseDateArg(arg) {
  const isoDate = arg || todayKst();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${arg} (예: 2026-09-20)`);
  }
  return isoDate;
}

function shiftIsoDate(isoDate, days) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// 소스별로 날짜 형식이 다르다(DART/Fed는 YYYYMMDD 압축형, SEC는
// YYYY-MM-DD) -- 각자 이미 그 형식으로 테스트/검증된 상태라 여기서
// 억지로 통일하지 않고 호출 시점에 필요한 형식으로만 변환해서 넘긴다.
async function runSource(label, fn) {
  try {
    const events = await fn();
    console.log(`  [${label}] ${events.length}건`);
    return events;
  } catch (error) {
    // 소스 하나가 실패해도(키 누락, 네트워크 오류 등) 나머지 소스로 계속
    // 진행한다 -- 한 소스 장애가 전체 파이프라인을 막으면 안 된다.
    console.warn(`  [${label}] 수집 실패, 이 소스는 건너뜁니다: ${error.message}`);
    return [];
  }
}

// 2군 소스(GDELT/네이버)는 { event, evidence } 쌍을 반환한다 -- 로그
// 형식만 다르고 실패 격리 원칙은 runSource와 동일하다.
async function runCandidateSource(label, fn) {
  try {
    const candidates = await fn();
    console.log(`  [${label}] ${candidates.length}건(검수 대기)`);
    return candidates;
  } catch (error) {
    console.warn(`  [${label}] 수집 실패, 이 소스는 건너뜁니다: ${error.message}`);
    return [];
  }
}

// 2군 후보 전체를 AI 검수 게이트에 한 번에(배치) 보내고, 승인된 이벤트와
// 반려 기록을 나눠서 돌려준다. 검수 게이트 자체가 실패하면(키 누락,
// API 장애 등) "일단 통과시킨다"가 아니라 이번 배치 전체를 안전하게
// 반려 처리한다 -- 검수를 못 받은 tier:2 이벤트가 그냥 발행되면 안 된다.
async function runReviewGate(candidates) {
  if (candidates.length === 0) return { approvedEvents: [], rejectedRecords: [] };

  const reviewInput = candidates.map(({ event, evidence }) => ({
    id: event.id,
    evidence,
    card: { headline: event.content.headline, chips: event.content.chips, horizon: event.content.horizon },
  }));

  let verdictMap;
  try {
    verdictMap = await reviewCandidates(reviewInput);
  } catch (error) {
    console.warn(`  ⚠ AI 검수 게이트 호출 실패, 이번 배치는 전부 반려 처리: ${error.message}`);
    verdictMap = new Map(reviewInput.map((c) => [c.id, { verdict: "reject", reason: `검수 게이트 호출 실패: ${error.message}` }]));
  }

  const approvedEvents = [];
  const rejectedRecords = [];
  for (const { event, evidence } of candidates) {
    const result = verdictMap.get(event.id) ?? { verdict: "reject", reason: "검수 결과 없음(안전 기본값)" };
    if (result.verdict === "approve") {
      approvedEvents.push({ ...event, reliability: { ...event.reliability, needs_review: false } });
    } else {
      rejectedRecords.push({ event, evidence, reason: result.reason });
    }
  }
  return { approvedEvents, rejectedRecords };
}

async function main() {
  const isoDate = parseDateArg(process.argv[2]);
  const compactDate = isoDate.replace(/-/g, "");
  console.log(`[전체 수집] 대상 날짜: ${isoDate}`);

  // Fed/SEC는 미국 동부 시각 기준 날짜로 필터링하는데, 이 파이프라인은
  // KST 07:00에 매일 도는 스케줄이다(.github/workflows/daily-briefing.yml).
  // 그 시점의 미국 동부는 전날 저녁(~18시, DST와 무관하게 항상 전날)이라,
  // "오늘(KST)" 날짜에 해당하는 미국 영업일은 그 시점에 아직 시작도 안 한
  // 상태다 -- 그래서 isoDate를 그대로 넘기면 Fed/SEC가 항상 0건만 반환한다
  // (실제 라이브 확인: SEC는 KST 어제 날짜로 조회하면 118건이 나오는데
  // KST 오늘 날짜로는 0건). Fed/SEC만 하루 전(그 시점 기준 "가장 최근에
  // 끝난" 미국 영업일)을 조회하도록 보정한다. 각 이벤트의 event_datetime은
  // API가 주는 실제 타임스탬프를 그대로 쓰므로, 화면의 날짜 그룹핑
  // (issue-briefing.js의 toKstDateLabel)은 이 보정과 무관하게 항상 정확하다.
  const usBusinessIsoDate = shiftIsoDate(isoDate, -1);
  const usBusinessCompactDate = usBusinessIsoDate.replace(/-/g, "");

  console.log("소스별 수집 중...");
  const [dartEvents, fedEvents, secEvents, kdataEvents, ecosEvents, gdeltCandidates, naverCandidates] = await Promise.all([
    runSource("DART", () => collectDartEvents(compactDate)),
    runSource("Fed", () => collectFedEvents(usBusinessCompactDate)),
    runSource("SEC", () => collectSecEvents(usBusinessIsoDate)),
    runSource("관세청", () => collectCustomsEvents(compactDate.slice(0, 6))),
    runSource("ECOS", () => collectEcosEvents(compactDate)),
    runCandidateSource("GDELT", () => collectGdeltCandidates(compactDate)),
    runCandidateSource("네이버뉴스", () => collectNaverCandidates(compactDate)),
  ]);

  const tier1Events = [...dartEvents, ...fedEvents, ...secEvents, ...kdataEvents, ...ecosEvents];
  const tier2Candidates = [...gdeltCandidates, ...naverCandidates];

  console.log(`2군 후보 ${tier2Candidates.length}건 AI 검수 게이트 통과 중...`);
  const { approvedEvents, rejectedRecords } = await runReviewGate(tier2Candidates);
  console.log(`  승인 ${approvedEvents.length}건 / 반려 ${rejectedRecords.length}건`);

  if (rejectedRecords.length > 0) {
    const rejectedDir = path.join(DATA_DIR, "rejected");
    await mkdir(rejectedDir, { recursive: true });
    const rejectedFile = path.join(rejectedDir, `${isoDate}.json`);
    await writeFile(rejectedFile, JSON.stringify(rejectedRecords, null, 2), "utf-8");
    console.log(`  반려 로그 저장: ${path.relative(ROOT_DIR, rejectedFile)}`);
  }

  const allEvents = [...tier1Events, ...approvedEvents];
  console.log(`전체 소스 합산(검수 통과분 포함) ${allEvents.length}건`);

  allEvents.sort((a, b) => b.scoring.priority_score - a.scoring.priority_score);
  const top = allEvents.slice(0, MAX_EVENTS);
  if (top.length < MIN_EVENTS_TARGET) {
    console.log(`참고: 오늘은 대상 이벤트가 적어 ${top.length}건만 선정되었습니다.`);
  }
  console.log(`우선순위 상위 ${top.length}건 선정 (소스: ${top.map((e) => e.source.type).join(", ") || "없음"})`);

  // 종합 신호는 top(상위 8건)이 아니라 allEvents(전체 합산본) 기준으로 집계한다
  // -- top 8건만 보면 한 섹터에 이벤트가 여러 건 겹쳐도 상위 스코어 몇 건만
  // 남아 "여러 이벤트가 겹치는 섹터"를 제대로 찾을 수 없다.
  const summary = buildSummary(allEvents);
  console.log(`종합 신호 섹터 ${summary.length}개 선정 (${summary.map((s) => s.name).join(", ") || "없음"})`);

  const payload = {
    date: isoDate,
    generated_at: new Date().toISOString(),
    summary,
    events: top,
  };

  const [year, month] = isoDate.split("-");
  const outDir = path.join(DATA_DIR, "events", year, month);
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${isoDate}.json`);
  const json = JSON.stringify(payload, null, 2);

  await writeFile(outFile, json, "utf-8");
  await writeFile(path.join(DATA_DIR, "latest.json"), json, "utf-8");

  console.log(`저장 완료: ${path.relative(ROOT_DIR, outFile)}`);
  console.log(`저장 완료: ${path.relative(ROOT_DIR, path.join(DATA_DIR, "latest.json"))}`);
}

main().catch((error) => {
  console.error("수집 실패:", error);
  process.exitCode = 1;
});
