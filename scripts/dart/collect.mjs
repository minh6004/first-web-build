// 순수 수집 로직만 담당(파일 I/O 없음, 우선순위 정렬/상위 N개 자르기도
// 하지 않음 -- 그건 병합 시점에 scripts/collect-all.mjs가 전체 소스를 합친
// 뒤 한 번만 한다). scripts/collect-all.mjs와 이 소스의 단독
// CLI(collect-events.mjs)가 둘 다 이 함수를 가져다 쓴다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllDisclosuresForDate } from "./dart-client.mjs";
import { normalizeDisclosure } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

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

/** @param {string} dateStr YYYYMMDD */
export async function collectDartEvents(dateStr, { onProgress } = {}) {
  const bellwetherMap = await loadBellwetherMap();
  const raws = await fetchAllDisclosuresForDate(dateStr, { onProgress });

  const events = [];
  for (const raw of raws) {
    try {
      const event = await normalizeDisclosure(raw, bellwetherMap);
      if (event) events.push(event);
    } catch (error) {
      console.warn(`  ⚠ DART 정규화 실패(${raw.rcept_no}, ${raw.corp_name}): ${error.message}`);
    }
  }
  return events;
}
