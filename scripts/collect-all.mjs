#!/usr/bin/env node
// 이슈 브리핑 데이터 파이프라인 -- 실제 운영용 진입점. DART/Fed/SEC/관세청
// (data.go.kr) 네 소스를 전부 모아서 같은 정규화 스키마로 병합하고, 우선순위
// 상위 5~8건만 data/events/YYYY/MM/YYYY-MM-DD.json + data/latest.json에
// 저장한다.
//
// 사용법: node --env-file=.env scripts/collect-all.mjs [YYYY-MM-DD]
//   (또는 .env 없이 DART_API_KEY=발급받은키 ... node scripts/collect-all.mjs 로 인라인 전달해도 됨)
//   DART_API_KEY, DATA_GO_KR_API_KEY가 필요하다(Fed/SEC는 공개 API라 키가
//   필요 없음). 프로젝트 루트의 .env.example을 복사해 .env를 만들고 실제
//   키를 채워 넣을 것 -- .env는 .gitignore에 이미 제외되어 있어 커밋되지 않는다.
//   날짜를 생략하면 오늘(KST) 날짜로 수집한다.
//
// ECOS(한국은행)는 아직 API 키가 없어서 이번 범위에서 빠져 있다 -- 키를
// 받으면 scripts/ecos/ 아래에 같은 구조(client/normalize/collect.mjs)로
// 추가하고 아래 SOURCES 배열에 한 줄만 더하면 된다.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectDartEvents } from "./dart/collect.mjs";
import { collectFedEvents } from "./fed/collect.mjs";
import { collectSecEvents } from "./sec/collect.mjs";
import { collectCustomsEvents } from "./kdata/collect.mjs";

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

async function main() {
  const isoDate = parseDateArg(process.argv[2]);
  const compactDate = isoDate.replace(/-/g, "");
  console.log(`[전체 수집] 대상 날짜: ${isoDate}`);

  console.log("소스별 수집 중...");
  const [dartEvents, fedEvents, secEvents, kdataEvents] = await Promise.all([
    runSource("DART", () => collectDartEvents(compactDate)),
    runSource("Fed", () => collectFedEvents(compactDate)),
    runSource("SEC", () => collectSecEvents(isoDate)),
    runSource("관세청", () => collectCustomsEvents(compactDate.slice(0, 6))),
  ]);

  const allEvents = [...dartEvents, ...fedEvents, ...secEvents, ...kdataEvents];
  console.log(`전체 소스 합산 ${allEvents.length}건`);

  allEvents.sort((a, b) => b.scoring.priority_score - a.scoring.priority_score);
  const top = allEvents.slice(0, MAX_EVENTS);
  if (top.length < MIN_EVENTS_TARGET) {
    console.log(`참고: 오늘은 대상 이벤트가 적어 ${top.length}건만 선정되었습니다.`);
  }
  console.log(`우선순위 상위 ${top.length}건 선정 (소스: ${top.map((e) => e.source.type).join(", ") || "없음"})`);

  const payload = {
    date: isoDate,
    generated_at: new Date().toISOString(),
    summary: [], // 종합 신호 집계 로직은 다음 단계 범위
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
