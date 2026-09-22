// 여러 소스(DART/Fed/SEC/kdata/...)에서 모인 이벤트를 섹터별로 묶어 "오늘의
// 변동성 신호" 카드 데이터를 만든다. 결과 모양은 issue-briefing.js의 더미
// SIGNAL_SECTORS와 동일하게 { id, name, events: [{name, direction, strength}] }
// 로 맞춰서, 프런트엔드가 실제/더미 데이터를 같은 렌더링 함수로 그릴 수 있게 한다.
const STRENGTH_LABEL = { strong: "강함", medium: "중간", weak: "약함" };
const MAX_EVENTS_PER_SECTOR = 6;

/**
 * @param {object[]} events 정규화된 이벤트 배열(병합/정렬 전, 전체 소스 합산본)
 * @param {{maxSectors?: number, minEventsPerSector?: number}} options
 */
export function buildSummary(events, { maxSectors = 3, minEventsPerSector = 2 } = {}) {
  const bySector = new Map();

  for (const event of events) {
    for (const affected of event.impact.affected_sectors) {
      if (affected.sector === "미분류") continue; // 대표주 화이트리스트 밖 -- 섹터 신호로 의미 없음
      const bucket = bySector.get(affected.sector) ?? [];
      bucket.push({
        name: event.content.headline,
        direction: affected.direction,
        strength: STRENGTH_LABEL[event.impact.strength] ?? "약함",
        priority: event.scoring.priority_score,
      });
      bySector.set(affected.sector, bucket);
    }
  }

  // "여러 이벤트가 겹치는 섹터"만 후보로 삼는다 -- 이벤트 1건짜리 섹터는
  // 애초에 "종합" 신호라고 부를 근거가 없다.
  const candidates = Array.from(bySector.entries())
    .filter(([, bucket]) => bucket.length >= minEventsPerSector)
    .map(([sector, bucket]) => ({
      sector,
      bucket: bucket.sort((a, b) => b.priority - a.priority).slice(0, MAX_EVENTS_PER_SECTOR),
    }));

  // 겹치는 이벤트 수가 많을수록 오늘 실제로 주목받는 섹터라는 뜻이라, 그
  // 기준으로 상위 2~3개를 뽑는다(변동성이 클 것 같은 섹터 선정 기준).
  candidates.sort((a, b) => b.bucket.length - a.bucket.length);

  return candidates.slice(0, maxSectors).map(({ sector, bucket }, index) => ({
    id: `sector-${index}`,
    name: sector,
    events: bucket.map(({ name, direction, strength }) => ({ name, direction, strength })),
  }));
}
