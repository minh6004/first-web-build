#!/usr/bin/env node
// DART 단독 수집 CLI -- 이 소스 하나만 따로 테스트할 때 쓴다.
// 주의: data/latest.json을 "이 소스의 결과만"으로 덮어쓴다. 실제 운영용
// 병합 저장은 scripts/collect-all.mjs를 쓸 것.
//
// 사용법:
//   DART_API_KEY=발급받은키 node scripts/dart/collect-events.mjs [YYYY-MM-DD]
//   날짜를 생략하면 오늘(KST) 날짜로 수집한다.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectDartEvents } from "./collect.mjs";

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

async function main() {
  const dateStr = parseDateArg(process.argv[2]);
  const isoDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  console.log(`[DART 수집] 대상 날짜: ${isoDate}`);

  console.log("공시 목록 조회 중...");
  const events = await collectDartEvents(dateStr, {
    onProgress: ({ pblntfTy, pageNo, count }) => {
      console.log(`  [${pblntfTy}] ${pageNo}페이지: ${count}건`);
    },
  });
  console.log(`분류/정규화 후 ${events.length}건`);

  events.sort((a, b) => b.scoring.priority_score - a.scoring.priority_score);
  const top = events.slice(0, MAX_EVENTS);
  if (top.length < MIN_EVENTS_TARGET) {
    console.log(`참고: 오늘은 대상 공시가 적어 ${top.length}건만 선정되었습니다.`);
  }
  console.log(`우선순위 상위 ${top.length}건 선정`);

  const payload = { date: isoDate, generated_at: new Date().toISOString(), summary: [], events: top };

  const outDir = path.join(DATA_DIR, "events", dateStr.slice(0, 4), dateStr.slice(4, 6));
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${isoDate}.json`);
  const json = JSON.stringify(payload, null, 2);

  await writeFile(outFile, json, "utf-8");
  await writeFile(path.join(DATA_DIR, "latest.json"), json, "utf-8");

  console.log(`저장 완료(DART 단독 결과로 덮어씀): ${path.relative(ROOT_DIR, outFile)}`);
}

main().catch((error) => {
  console.error("수집 실패:", error);
  process.exitCode = 1;
});
