// 순수 수집 로직만 담당(파일 I/O 없음) -- scripts/collect-all.mjs와 이
// 소스의 단독 CLI(collect-events.mjs)가 둘 다 이 함수를 가져다 쓴다.
//
// 주의: DART/Fed/SEC/kdata/ecos의 collect*Events()는 이벤트 배열을 바로
// 반환하지만, 이 함수는 2군 소스라 { event, evidence } 쌍의 배열을
// 반환한다 -- evidence는 AI 검수 게이트(scripts/review/)가 event의 주장이
// 근거로 뒷받침되는지 판단할 때 쓰는 원본 자료다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSectorNewsCandidate } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

async function loadSectorKeywords() {
  // 별도 키워드 목록을 새로 만들지 않고, DART가 이미 쓰는 대표주
  // 화이트리스트의 섹터 이름을 그대로 뉴스 검색 키워드로 재사용한다.
  const raw = await readFile(path.join(DATA_DIR, "bellwether-list.json"), "utf-8");
  return Object.keys(JSON.parse(raw));
}

/** @param {string} dateStr YYYYMMDD(KST) */
export async function collectNaverCandidates(dateStr) {
  const sectors = await loadSectorKeywords();
  const candidates = [];

  for (const sector of sectors) {
    try {
      const candidate = await normalizeSectorNewsCandidate(sector, dateStr);
      if (candidate) candidates.push(candidate);
    } catch (error) {
      console.warn(`  ⚠ 네이버뉴스 수집 실패(${sector}): ${error.message}`);
    }
  }
  return candidates;
}
