// 순수 수집 로직만 담당(파일 I/O 없음, 정렬/상위 N개 자르기 없음) --
// scripts/collect-all.mjs와 이 소스의 단독 CLI(collect-events.mjs)가 공유.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findLatestAvailableMonth, fetchItemTradeTotal, shiftYymm } from "./customs-client.mjs";
import { normalizeCustomsEvent } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

async function loadWatchlist() {
  const raw = await readFile(path.join(DATA_DIR, "hs-code-watchlist.json"), "utf-8");
  return JSON.parse(raw);
}

/** @param {string} referenceYymm 기준 연월(YYYYMM), 이 달부터 거슬러 올라가며 최신 발표월을 찾는다 */
export async function collectCustomsEvents(referenceYymm) {
  const watchlist = await loadWatchlist();

  const events = [];
  for (const [sectorName, hsInfo] of Object.entries(watchlist)) {
    try {
      const latest = await findLatestAvailableMonth(hsInfo.hsCode, referenceYymm);
      if (!latest) continue; // 최근 몇 달치 다 데이터가 없으면 이번 섹터는 건너뜀

      const sameMonthLastYear = await fetchItemTradeTotal(hsInfo.hsCode, shiftYymm(latest.yymm, 12));
      const sameMonthLastYearEntry = sameMonthLastYear
        ? { yymm: shiftYymm(latest.yymm, 12), total: sameMonthLastYear }
        : null;

      events.push(normalizeCustomsEvent(sectorName, hsInfo, latest, sameMonthLastYearEntry));
    } catch (error) {
      console.warn(`  ⚠ 관세청 수집 실패(${sectorName}, HS ${hsInfo.hsCode}): ${error.message}`);
    }
  }
  return events;
}
