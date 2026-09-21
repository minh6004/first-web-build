// 순수 수집 로직만 담당(파일 I/O 없음) -- scripts/collect-all.mjs와 이
// 소스의 단독 CLI(collect-events.mjs)가 둘 다 이 함수를 가져다 쓴다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchSecFilingsForDate } from "./sec-client.mjs";
import { normalizeSecFiling } from "./normalize.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

async function loadBellwetherMapUs() {
  const raw = await readFile(path.join(DATA_DIR, "bellwether-list-us.json"), "utf-8");
  const bySector = JSON.parse(raw);
  return new Map(Object.entries(bySector));
}

export async function collectSecEvents(isoDate) {
  const bellwetherMapUs = await loadBellwetherMapUs();
  const filings = await fetchSecFilingsForDate(isoDate);
  const events = [];
  for (const filing of filings) {
    try {
      const event = normalizeSecFiling(filing, bellwetherMapUs);
      if (event) events.push(event);
    } catch (error) {
      console.warn(`  ⚠ SEC 필링 정규화 실패(${filing.link}): ${error.message}`);
    }
  }
  return events;
}
