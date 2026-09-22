// 순수 수집 로직만 담당(파일 I/O 없음). naver/collect.mjs와 마찬가지로
// 2군 소스라 { event, evidence } 쌍의 배열을 반환한다(evidence는 AI 검수
// 게이트가 쓰는 원본 자료).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSectorBuzzCandidate } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

async function loadSectorKeywords() {
  const raw = await readFile(path.join(DATA_DIR, "bellwether-list.json"), "utf-8");
  return Object.keys(JSON.parse(raw));
}

/** @param {string} dateStr YYYYMMDD(KST) */
export async function collectGdeltCandidates(dateStr) {
  const sectors = await loadSectorKeywords();
  const candidates = [];

  for (const sector of sectors) {
    try {
      const candidate = await normalizeSectorBuzzCandidate(sector, dateStr);
      if (candidate) candidates.push(candidate);
    } catch (error) {
      console.warn(`  ⚠ GDELT 수집 실패(${sector}): ${error.message}`);
    }
  }
  return candidates;
}
