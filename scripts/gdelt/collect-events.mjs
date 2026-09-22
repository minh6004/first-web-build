#!/usr/bin/env node
// GDELT 단독 수집 CLI -- 이 소스 하나만 따로 테스트할 때 쓴다.
// 주의: data/latest.json을 "이 소스의 결과만"으로 덮어쓴다. AI 검수 게이트를
// 거치지 않은 원본(needs_review: true 그대로)을 저장한다 -- 실제 운영용
// 병합+검수는 scripts/collect-all.mjs를 쓸 것.
// GDELT가 5초당 1회 요청 제한이 있어서 섹터가 많으면 수십 초 걸릴 수 있다.
//
// 사용법:
//   node scripts/gdelt/collect-events.mjs [YYYY-MM-DD]  (키 불필요)
//   날짜를 생략하면 오늘(KST) 날짜로 수집한다.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectGdeltCandidates } from "./collect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

function parseDateArg(arg) {
  if (!arg) return todayKst();
  const digits = arg.replace(/-/g, "");
  if (!/^\d{8}$/.test(digits)) {
    throw new Error(`날짜 형식이 올바르지 않습니다: ${arg} (예: 2026-09-22 또는 20260922)`);
  }
  return digits;
}

async function main() {
  const dateStr = parseDateArg(process.argv[2]);
  const isoDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  console.log(`[GDELT 수집] 대상 날짜: ${isoDate} (검수 게이트 미적용, needs_review 원본)`);

  const candidates = await collectGdeltCandidates(dateStr);
  const events = candidates.map((c) => c.event);
  console.log(`수집된 후보(스파이크 감지됨): ${events.length}건`);

  events.sort((a, b) => b.scoring.priority_score - a.scoring.priority_score);

  const payload = { date: isoDate, generated_at: new Date().toISOString(), summary: [], events };

  const [year, month] = isoDate.split("-");
  const outDir = path.join(DATA_DIR, "events", year, month);
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${isoDate}.json`);
  const json = JSON.stringify(payload, null, 2);

  await writeFile(outFile, json, "utf-8");
  await writeFile(path.join(DATA_DIR, "latest.json"), json, "utf-8");

  console.log(`저장 완료(GDELT 단독, 검수 전 원본): ${path.relative(ROOT_DIR, outFile)}`);
}

main().catch((error) => {
  console.error("수집 실패:", error);
  process.exitCode = 1;
});
