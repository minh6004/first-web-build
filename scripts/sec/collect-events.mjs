#!/usr/bin/env node
// SEC EDGAR 단독 수집 CLI -- 이 소스 하나만 따로 테스트할 때 쓴다.
// 주의: data/latest.json을 "이 소스의 결과만"으로 덮어쓴다. 실제 운영용
// 병합 저장은 scripts/collect-all.mjs를 쓸 것.
//
// 사용법: node scripts/sec/collect-events.mjs [YYYY-MM-DD]
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectSecEvents } from "./collect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

function todayKst() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

async function main() {
  const isoDate = process.argv[2] || todayKst();
  console.log(`[SEC 수집] 대상 날짜: ${isoDate}`);

  const events = await collectSecEvents(isoDate);
  console.log(`${events.length}건 수집됨`);

  const payload = { date: isoDate, generated_at: new Date().toISOString(), summary: [], events };
  const [y, m] = isoDate.split("-");
  const outDir = path.join(DATA_DIR, "events", y, m);
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${isoDate}.json`);
  const json = JSON.stringify(payload, null, 2);
  await writeFile(outFile, json, "utf-8");
  await writeFile(path.join(DATA_DIR, "latest.json"), json, "utf-8");
  console.log(`저장 완료(SEC 단독 결과로 덮어씀): ${path.relative(ROOT_DIR, outFile)}`);
}

main().catch((error) => {
  console.error("수집 실패:", error);
  process.exitCode = 1;
});
