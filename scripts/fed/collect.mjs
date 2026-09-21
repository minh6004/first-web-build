// 순수 수집 로직만 담당(파일 I/O 없음) -- scripts/collect-all.mjs와 이
// 소스의 단독 CLI(collect-events.mjs)가 둘 다 이 함수를 가져다 쓴다.
import { fetchFedPressReleasesForDate } from "./fed-client.mjs";
import { normalizeFedPressRelease } from "./normalize.mjs";

export async function collectFedEvents(dateStr) {
  const items = await fetchFedPressReleasesForDate(dateStr);
  const events = [];
  for (const item of items) {
    try {
      const event = await normalizeFedPressRelease(item);
      if (event) events.push(event);
    } catch (error) {
      console.warn(`  ⚠ 연준 보도자료 정규화 실패(${item.link}): ${error.message}`);
    }
  }
  return events;
}
