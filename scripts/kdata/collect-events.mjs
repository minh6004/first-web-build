#!/usr/bin/env node
// 관세청(data.go.kr) 단독 수집 CLI -- 이 소스 하나만 따로 테스트할 때 쓴다.
// 주의: data/latest.json을 "이 소스의 결과만"으로 덮어쓴다. 실제 운영용
// 병합 저장은 scripts/collect-all.mjs를 쓸 것.
//
// 사용법:
//   node --env-file=.env scripts/kdata/collect-events.mjs [YYYY-MM]
//   날짜(연월)를 생략하면 이번 달(KST) 기준으로 최신 발표월을 찾는다.
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectCustomsEvents } from "./collect.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");

function todayKstYymm() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 7).replace("-", "");
}

function parseYymmArg(arg) {
  if (!arg) return todayKstYymm();
  const digits = arg.replace(/-/g, "");
  if (!/^\d{6}$/.test(digits)) {
    throw new Error(`연월 형식이 올바르지 않습니다: ${arg} (예: 2026-09 또는 202609)`);
  }
  return digits;
}

async function main() {
  const referenceYymm = parseYymmArg(process.argv[2]);
  console.log(`[관세청 수집] 기준 연월: ${referenceYymm}`);

  const events = await collectCustomsEvents(referenceYymm);
  console.log(`수집된 섹터 이벤트: ${events.length}건`);

  events.sort((a, b) => b.scoring.priority_score - a.scoring.priority_score);

  const isoDate = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const payload = { date: isoDate, generated_at: new Date().toISOString(), summary: [], events };

  const [year, month] = isoDate.split("-");
  const outDir = path.join(DATA_DIR, "events", year, month);
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${isoDate}.json`);
  const json = JSON.stringify(payload, null, 2);

  await writeFile(outFile, json, "utf-8");
  await writeFile(path.join(DATA_DIR, "latest.json"), json, "utf-8");

  console.log(`저장 완료(관세청 단독 결과로 덮어씀): ${path.relative(ROOT_DIR, outFile)}`);
}

main().catch((error) => {
  console.error("수집 실패:", error);
  process.exitCode = 1;
});
