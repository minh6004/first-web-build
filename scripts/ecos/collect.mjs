// 순수 수집 로직만 담당(파일 I/O 없음) -- scripts/collect-all.mjs와 이
// 소스의 단독 CLI(collect-events.mjs)가 둘 다 이 함수를 가져다 쓴다.
import { normalizeBaseRateEvent, normalizeExchangeRateEvent, normalizeCpiEvent } from "./normalize.mjs";

/** @param {string} dateStr YYYYMMDD */
export async function collectEcosEvents(dateStr) {
  const events = [];

  // 지표 하나가 실패해도(그 시점에 데이터가 없는 등) 나머지 지표는 계속
  // 수집한다 -- kdata의 섹터별 try/catch와 같은 패턴.
  const indicators = [
    { label: "기준금리", fn: () => normalizeBaseRateEvent(dateStr) },
    { label: "원/달러 환율", fn: () => normalizeExchangeRateEvent(dateStr) },
    { label: "소비자물가(CPI)", fn: () => normalizeCpiEvent(dateStr) },
  ];

  for (const { label, fn } of indicators) {
    try {
      const event = await fn();
      if (event) events.push(event);
    } catch (error) {
      console.warn(`  ⚠ ECOS 수집 실패(${label}): ${error.message}`);
    }
  }

  return events;
}
