#!/usr/bin/env node
// DART 이슈 브리핑 수집 스크립트 (1차 구현, DART 단일 소스).
//
// 사용법:
//   DART_API_KEY=발급받은키 node scripts/dart/collect-events.mjs [YYYY-MM-DD]
//   날짜를 생략하면 오늘(KST) 날짜로 수집한다.
//
// 동작: DART 공시 목록 조회 -> 스펙 스키마로 정규화 -> 우선순위 정렬 ->
// 상위 5~8건만 남겨서 data/events/YYYY/MM/YYYY-MM-DD.json과
// data/latest.json에 저장한다.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllDisclosuresForDate } from "./dart-client.mjs";
import { normalizeDisclosure } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

const MAX_EVENTS = 8;
const MIN_EVENTS_TARGET = 5; // 참고용 -- 결과가 이보다 적어도 그대로 저장한다.

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC -> KST
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

function parseDateArg(arg) {
  if (!arg) return todayKst();
  const digits = arg.replace(/-/g, "");
  if (!/^\d{8}$/.test(digits)) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${arg} (예: 2026-09-20 또는 20260920)`);
  }
  return digits;
}

async function loadBellwetherMap() {
  const raw = await readFile(path.join(DATA_DIR, "bellwether-list.json"), "utf-8");
  const bySector = JSON.parse(raw);
  const map = new Map();
  for (const [sector, codes] of Object.entries(bySector)) {
    for (const code of codes) {
      const entry = map.get(code) ?? { sectors: [] };
      entry.sectors.push(sector);
      map.set(code, entry);
    }
  }
  return map;
}

async function main() {
  const dateStr = parseDateArg(process.argv[2]);
  const isoDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  console.log(`[DART 수집] 대상 날짜: ${isoDate}`);

  const bellwetherMap = await loadBellwetherMap();
  console.log(`대표주 화이트리스트 ${bellwetherMap.size}종목 로드`);

  console.log("공시 목록 조회 중...");
  const raws = await fetchAllDisclosuresForDate(dateStr, {
    onProgress: ({ pblntfTy, pageNo, count }) => {
      console.log(`  [${pblntfTy}] ${pageNo}페이지: ${count}건`);
    },
  });
  console.log(`총 ${raws.length}건의 원본 공시 조회됨`);

  console.log("정규화 진행 중 (정기공시는 재무제표도 함께 조회합니다)...");
  const events = [];
  for (const raw of raws) {
    try {
      const event = await normalizeDisclosure(raw, bellwetherMap);
      if (event) events.push(event);
    } catch (error) {
      console.warn(`  ⚠ 정규화 실패(${raw.rcept_no}, ${raw.corp_name}): ${error.message}`);
    }
  }
  console.log(`분류/정규화 후 ${events.length}건 남음`);

  events.sort((a, b) => b.scoring.priority_score - a.scoring.priority_score);
  const top = events.slice(0, MAX_EVENTS);
  if (top.length < MIN_EVENTS_TARGET) {
    console.log(`참고: 오늘은 대상 공시가 적어 ${top.length}건만 선정되었습니다.`);
  }
  console.log(`우선순위 상위 ${top.length}건 선정`);

  const payload = {
    date: isoDate,
    generated_at: new Date().toISOString(),
    summary: [], // DART 단일 소스 단계에서는 비워둔다 (스펙 4번 참고)
    events: top,
  };

  const outDir = path.join(DATA_DIR, "events", dateStr.slice(0, 4), dateStr.slice(4, 6));
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
