#!/usr/bin/env node
// 연준(Fed) 단독 수집 CLI -- 이 소스 하나만 따로 테스트할 때 쓴다.
// 주의: data/latest.json을 "이 소스의 결과만"으로 덮어쓴다. 실제 운영용
// 병합 저장은 scripts/collect-all.mjs를 쓸 것.
//
// 사용법: node scripts/fed/collect-events.mjs [YYYY-MM-DD]
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectFedEvents } from "./collect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10).replace(/-/g, "");
}

async function main() {
  const dateStr = (process.argv[2] || todayKst()).replace(/-/g, "");
  const isoDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  console.log(`[Fed 수집] 대상 날짜: ${isoDate}`);

  const events = await collectFedEvents(dateStr);
  console.log(`${events.length}건 수집됨`);

  const payload = { date: isoDate, generated_at: new Date().toISOString(), summary: [], events };
  const outDir = path.join(DATA_DIR, "events", dateStr.slice(0, 4), dateStr.slice(4, 6));
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${isoDate}.json`);
  const json = JSON.stringify(payload, null, 2);
  await writeFile(outFile, json, "utf-8");
  await writeFile(path.join(DATA_DIR, "latest.json"), json, "utf-8");
  console.log(`저장 완료(Fed 단독 결과로 덮어씀): ${path.relative(ROOT_DIR, outFile)}`);
}

main().catch((error) => {
  console.error("수집 실패:", error);
  process.exitCode = 1;
});
