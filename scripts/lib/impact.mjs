// 모든 소스(DART/Fed/SEC/...)가 공유하는 영향(impact)/스코어링(scoring) 계산.
//
// 지난 DART 작업에서 나온 교훈: 프런트엔드(issue-briefing.js)에서 방향을
// up/down 두 값으로만 처리하다가 "neutral"(방향성이 뚜렷하지 않은 이벤트)이
// 조용히 "하락"으로 잘못 표시되는 버그가 있었다. 백엔드 쪽에서도 같은 실수가
// 소스별로 반복되지 않도록, "값 하나를 받아 up/down/neutral 셋 중 하나를
// 반드시 명시적으로 반환하는" 이 함수 하나만 모든 소스가 공유해서 쓴다 --
// 새 소스를 추가할 때 이 판정 로직을 각자 다시 구현하지 말고 항상 여기서
// import해서 쓸 것.
export function computeDirection(value) {
  if (value == null) return "neutral";
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "neutral";
}

export function computeStrength(value) {
  const absVal = value != null ? Math.abs(value) : 0;
  if (absVal >= 20) return "strong";
  if (absVal >= 5) return "medium";
  return "weak";
}

/**
 * YoY류 수치들(있는 것만)로부터 대표 방향/강도를 구한다. 값이 하나도 없으면
 * (예: 재무 데이터가 없는 수시공시) direction은 반드시 "neutral"이지 "down"이
 * 아니다 -- computeDirection(null)이 이를 보장한다.
 */
export function computeImpactFromMetrics(metricValues, sectors, note) {
  const primary = metricValues.find((v) => v != null) ?? null;
  const direction = computeDirection(primary);
  const strength = computeStrength(primary);
  return {
    direction,
    strength,
    affected_sectors: sectors.map((sector) => ({ sector, direction, note })),
  };
}

/**
 * 이미 방향이 정해진 섹터별 영향 목록이 있는 경우(예: 금리 결정처럼 섹터마다
 * 반응이 다른 이벤트)를 위한 버전. affectedSectors는
 * [{sector, direction}, ...] 형태로 이미 완성되어 있어야 하고, 이 함수는
 * 대표 direction/strength만 계산해서 감싸준다. 대표 방향은 가장 많이 등장한
 * 방향(동률이면 up > down > neutral 순)으로 정한다.
 */
export function computeImpactFromSectorDirections(affectedSectors, strengthHint = "medium") {
  const counts = { up: 0, down: 0, neutral: 0 };
  for (const { direction } of affectedSectors) {
    counts[direction] = (counts[direction] ?? 0) + 1;
  }
  const direction =
    counts.up >= counts.down && counts.up >= counts.neutral
      ? counts.up > 0
        ? "up"
        : "neutral"
      : counts.down >= counts.neutral
        ? "down"
        : "neutral";

  return { direction, strength: strengthHint, affected_sectors: affectedSectors };
}

const TYPE_PRIORITY_WEIGHT = {
  ma: 10,
  contract: 5,
  rate_decision: 15, // 금리 결정은 시장 전반에 영향을 주는 이벤트라 가중치를 더 준다
  macro_indicator: 8,
};

/**
 * 서프라이즈 점수(0~1)와 대표주 여부/이벤트 유형으로 우선순위 점수(0~100)를
 * 계산한다. 모든 소스가 같은 공식을 쓴다 -- 소스마다 다른 스코어링을 쓰면
 * 병합 후 정렬이 공정하지 않게 된다.
 */
export function computeScoring({ surpriseScore, isBellwether, type }) {
  let priority = surpriseScore * 60;
  if (isBellwether) priority += 25;
  priority += TYPE_PRIORITY_WEIGHT[type] ?? 0;
  priority = Math.round(Math.min(priority, 100));

  return {
    surprise_score: Math.round(surpriseScore * 100) / 100,
    price_trigger: false,
    price_change_pct: null,
    watchlist_boost: false,
    priority_score: priority,
  };
}

/** |YoY| 등 값 하나를 0~1 서프라이즈 점수로 정규화한다(50%에서 포화). */
export function surpriseScoreFromValues(values, saturateAt = 50) {
  const present = values.filter((v) => v != null);
  if (present.length === 0) return 0;
  const maxAbs = Math.max(...present.map(Math.abs));
  return Math.min(maxAbs / saturateAt, 1);
}
