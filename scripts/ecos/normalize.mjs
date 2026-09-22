// 한국은행 ECOS 지표(기준금리/원달러 환율/소비자물가지수) -> 정규화 이벤트
// 스키마. 방향 판정은 다른 소스와 마찬가지로 scripts/lib/impact.mjs의
// computeDirection만 쓴다 -- 세 지표 다 "변화가 없으면 neutral"을 항상
// 명시적으로 거친다.
import { computeDirection, computeScoring, surpriseScoreFromValues } from "../lib/impact.mjs";
import { fetchStatisticSearch, shiftDateDays, shiftMonths } from "./ecos-client.mjs";

const BASE_RATE = { statCode: "722Y001", itemCode1: "0101000" };
const FX_USD = { statCode: "731Y001", itemCode1: "0000001" };
const CPI = { statCode: "901Y009", itemCode1: "0" };

function round1(n) {
  return Math.round(n * 10) / 10;
}

function toEventDatetime(yyyymmdd) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}T12:00:00+09:00`;
}

// ---------------------------------------------------------------------------
// 1. 기준금리 -- 매일 같은 값이 반복되는 시계열이라, "어제와 오늘 값이
//    다른가"로 실제 결정이 있었던 날만 골라낸다. 값이 같으면(대부분의 날)
//    이벤트를 만들지 않는다 -- 매일 "동결" 이벤트를 양산하면 의미가 없다.
// ---------------------------------------------------------------------------

function rateDecisionSectorImpacts(direction) {
  if (direction === "up") {
    return [
      { sector: "금융", direction: "up" },
      { sector: "부동산", direction: "down" },
      { sector: "성장주", direction: "down" },
    ];
  }
  if (direction === "down") {
    return [
      { sector: "금융", direction: "down" },
      { sector: "부동산", direction: "up" },
      { sector: "성장주", direction: "up" },
    ];
  }
  return [{ sector: "금융", direction: "neutral" }];
}

function buildRateHorizon(direction, changeBp) {
  if (direction === "up") {
    return {
      short_term: `한국은행이 기준금리를 ${changeBp}bp 인상해 단기적으로 대출 부담이 커진 성장주·부동산 관련주에 부담이 될 수 있어요.`,
      long_term: "추가 인상 가능성과 속도가 중장기적으로 국내 자산 가격의 핵심 변수가 될 거예요.",
    };
  }
  return {
    short_term: `한국은행이 기준금리를 ${changeBp}bp 인하해 단기적으로 위험자산 선호 심리가 살아날 수 있어요.`,
    long_term: "인하 기조가 얼마나 이어지는지가 중장기 국내 자산 가격의 핵심 변수가 될 거예요.",
  };
}

export async function normalizeBaseRateEvent(dateStr) {
  const rows = await fetchStatisticSearch({
    ...BASE_RATE,
    cycle: "D",
    startDate: shiftDateDays(dateStr, 14),
    endDate: dateStr,
    count: 30,
  });
  if (rows.length < 2) return null; // 비교할 직전 영업일 데이터가 없음

  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  // bp는 원본(반올림 전) 차이로 계산한다 -- 0.25%p(25bp)처럼 소수 둘째
  // 자리가 의미 있는 값을 1자리로 먼저 반올림(round1)하면 JS의 반올림 규칙
  // (Math.round(2.5)===3) 때문에 0.25 -> 0.3으로 밀려서 25bp가 30bp로
  // 둔갑하는 버그가 생긴다. 화면 표시용 %p만 round1을 쓰고, bp 계산은 항상
  // 원본 차이에서 한다.
  const rawChangePct = latest.value - previous.value;
  if (rawChangePct === 0) return null; // 이 기간엔 실제 금리 변경이 없었음

  const direction = computeDirection(rawChangePct);
  const changeBp = Math.round(Math.abs(rawChangePct) * 100);
  const sectors = rateDecisionSectorImpacts(direction);
  const scoring = computeScoring({
    surpriseScore: surpriseScoreFromValues([changeBp], 50), // Fed 쪽과 동일 컨벤션(50bp 포화)
    isBellwether: true,
    type: "rate_decision",
  });

  return {
    id: `ecos-rate-${latest.time}`,
    source: { type: "ecos", ref_id: `rate-${latest.time}`, url: "https://ecos.bok.or.kr/", tier: 1 },
    event_datetime: toEventDatetime(latest.time),
    collected_at: new Date().toISOString(),
    type: "rate_decision",
    category: "통화정책",
    subject: {
      entity_type: "macro",
      code: "KR-BOK",
      name: "한국은행",
      is_bellwether: true,
      sectors: sectors.map((s) => s.sector),
    },
    metrics: { rate_change_bp: direction === "down" ? -changeBp : changeBp, rate_value_pct: latest.value },
    scoring,
    impact: { direction, strength: changeBp >= 50 ? "strong" : "medium", affected_sectors: sectors },
    content: {
      meta_line: `한국은행 · ${latest.time.slice(4, 6)}.${latest.time.slice(6, 8)} · 통화정책`,
      headline: `한국은행, 기준금리 ${direction === "up" ? "인상" : "인하"} 결정 (${latest.value}%)`,
      chips: sectors.map((s) => `${s.sector}${s.direction === "up" ? "↑" : s.direction === "down" ? "↓" : "→"}`),
      horizon: buildRateHorizon(direction, changeBp),
    },
    reliability: { tier: 1, needs_review: false, corroboration_count: 0 },
    updates: [],
    status: "active",
  };
}

// ---------------------------------------------------------------------------
// 2. 원/달러 환율 -- 매일 값이 바뀌는 시계열이라 조회할 때마다 "직전 영업일
//    대비 등락"을 이벤트로 만든다. 작은 등락도 이벤트 자체는 생성하되(억지로
//    걸러내지 않음), surprise_score 포화 기준을 주가 YoY(수십 %)가 아니라
//    실제 하루 환율 변동폭 규모(1~2%면 큰 편)에 맞춰서, 사소한 변동은 자연히
//    낮은 우선순위로 밀려나게 한다.
// ---------------------------------------------------------------------------

function fxSectorImpacts(direction) {
  // 환율 상승(원화 약세)은 수출 가격 경쟁력에 우호적이라 수출주에 긍정적,
  // 반대로 원화 강세는 해외 소비·여행 비용 부담을 줄여준다.
  if (direction === "up") {
    return [
      { sector: "수출주", direction: "up" },
      { sector: "여행", direction: "down" },
    ];
  }
  if (direction === "down") {
    return [
      { sector: "수출주", direction: "down" },
      { sector: "여행", direction: "up" },
    ];
  }
  return [{ sector: "수출주", direction: "neutral" }];
}

function fxStrength(changePct) {
  const abs = Math.abs(changePct);
  if (abs >= 1) return "strong"; // 원/달러 하루 변동폭이 1% 이상이면 시장에서 크게 다루는 수준
  if (abs >= 0.3) return "medium";
  return "weak";
}

function buildFxHorizon(direction, changePct) {
  if (direction === "up") {
    return {
      short_term: `원/달러 환율이 전일 대비 ${changePct}% 올라(원화 약세) 단기적으로 수출 기업의 가격 경쟁력에 우호적일 수 있어요.`,
      long_term: "이 흐름이 추세적인지, 단기 변동인지에 따라 수입 물가·기업 실적에 미치는 영향이 달라져요.",
    };
  }
  if (direction === "down") {
    return {
      short_term: `원/달러 환율이 전일 대비 ${Math.abs(changePct)}% 내려(원화 강세) 단기적으로 수입 물가 부담이 줄어들 수 있어요.`,
      long_term: "원화 강세가 이어지면 수출 기업의 가격 경쟁력에는 부담이 될 수 있어요.",
    };
  }
  return {
    short_term: "원/달러 환율이 전일과 비슷한 수준을 유지했어요.",
    long_term: "뚜렷한 방향성이 나타나는지 다음 거래일을 지켜볼 필요가 있어요.",
  };
}

export async function normalizeExchangeRateEvent(dateStr) {
  const rows = await fetchStatisticSearch({
    ...FX_USD,
    cycle: "D",
    startDate: shiftDateDays(dateStr, 10),
    endDate: dateStr,
    count: 20,
  });
  if (rows.length < 2) return null;

  const latest = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  const changePct = round1(((latest.value - previous.value) / previous.value) * 100);

  const direction = computeDirection(changePct);
  const sectors = fxSectorImpacts(direction);
  const scoring = computeScoring({
    surpriseScore: surpriseScoreFromValues([changePct], 2), // 하루 2% 변동이면 포화(매우 큰 변동)
    isBellwether: true,
    type: "macro_indicator",
  });

  return {
    id: `ecos-fx-${latest.time}`,
    source: { type: "ecos", ref_id: `fx-usd-${latest.time}`, url: "https://ecos.bok.or.kr/", tier: 1 },
    event_datetime: toEventDatetime(latest.time),
    collected_at: new Date().toISOString(),
    type: "macro_indicator",
    category: "환율",
    subject: {
      entity_type: "macro",
      code: "KR-USD-FX",
      name: "원/달러 환율",
      is_bellwether: true,
      sectors: sectors.map((s) => s.sector),
    },
    metrics: { fx_value_krw: latest.value, fx_change_pct: changePct },
    scoring,
    impact: { direction, strength: fxStrength(changePct), affected_sectors: sectors },
    content: {
      meta_line: `원/달러 환율 · ${latest.time.slice(4, 6)}.${latest.time.slice(6, 8)} · 환율`,
      headline: `원/달러 환율 ${latest.value}원 (전일 대비 ${changePct >= 0 ? "+" : ""}${changePct}%)`,
      chips: sectors.map((s) => `${s.sector}${s.direction === "up" ? "↑" : s.direction === "down" ? "↓" : "→"}`),
      horizon: buildFxHorizon(direction, changePct),
    },
    reliability: { tier: 1, needs_review: false, corroboration_count: 0 },
    updates: [],
    status: "active",
  };
}

// ---------------------------------------------------------------------------
// 3. 소비자물가지수(CPI) -- "전년동월대비 상승률"은 한국이 대부분의 시기에
//    항상 양수라(만성적 물가 상승), 그 부호만 direction으로 쓰면 거의 항상
//    "up"이 나와서 의미가 없다. 실제로 시장이 보는 건 "이번 달 YoY 상승률이
//    지난달보다 더 높아졌는가(가속) 낮아졌는가(둔화)"라서, 그 차이를
//    direction으로 쓴다.
// ---------------------------------------------------------------------------

const CPI_LOOKBACK_MONTHS = 20; // 이번달/지난달 YoY를 다 구하려면 13~14개월치가 필요 -- 여유 있게 20개월

function findByTime(rows, time) {
  return rows.find((r) => r.time === time) ?? null;
}

function cpiSectorImpacts(direction) {
  // 물가 상승률이 가속되면 금리 인상 압력으로 읽혀 성장주에 부담,
  // 둔화되면 금리 인하 기대로 이어져 성장주에 우호적.
  if (direction === "up") return [{ sector: "성장주", direction: "down" }];
  if (direction === "down") return [{ sector: "성장주", direction: "up" }];
  return [{ sector: "성장주", direction: "neutral" }];
}

function buildCpiHorizon(direction, latestYoyPct) {
  if (direction === "up") {
    return {
      short_term: `소비자물가 상승률(전년동월대비 ${latestYoyPct}%)이 전월보다 더 높아져 단기적으로 금리 인상 우려가 커질 수 있어요.`,
      long_term: "물가 상승세가 다음 달에도 이어지는지가 통화정책 방향을 좌우하는 핵심 변수예요.",
    };
  }
  if (direction === "down") {
    return {
      short_term: `소비자물가 상승률(전년동월대비 ${latestYoyPct}%)이 전월보다 낮아져 단기적으로 금리 인하 기대가 커질 수 있어요.`,
      long_term: "물가 둔화가 추세로 이어지는지가 다음 통화정책 결정에 중요한 근거가 돼요.",
    };
  }
  return {
    short_term: `소비자물가 상승률이 전년동월대비 ${latestYoyPct}%로 전월과 비슷한 수준을 유지했어요.`,
    long_term: "뚜렷한 가속·둔화 신호가 나타나는지 다음 달 발표를 지켜볼 필요가 있어요.",
  };
}

export async function normalizeCpiEvent(dateStr) {
  const endYm = dateStr.slice(0, 6);
  const rows = await fetchStatisticSearch({
    ...CPI,
    cycle: "M",
    startDate: shiftMonths(endYm, CPI_LOOKBACK_MONTHS),
    endDate: endYm,
    count: 30,
  });
  if (rows.length < 2) return null;

  const latest = rows[rows.length - 1];
  const prevMonth = rows[rows.length - 2];
  const latestYoyBase = findByTime(rows, shiftMonths(latest.time, 12));
  const prevYoyBase = findByTime(rows, shiftMonths(prevMonth.time, 12));
  if (!latestYoyBase || !prevYoyBase) return null; // 비교할 전년동월 데이터가 없으면 억지로 계산하지 않음

  const latestYoyPct = round1(((latest.value - latestYoyBase.value) / latestYoyBase.value) * 100);
  const prevYoyPct = round1(((prevMonth.value - prevYoyBase.value) / prevYoyBase.value) * 100);
  const accelDeltaPct = round1(latestYoyPct - prevYoyPct);

  const direction = computeDirection(accelDeltaPct);
  const sectors = cpiSectorImpacts(direction);
  const scoring = computeScoring({
    surpriseScore: surpriseScoreFromValues([accelDeltaPct], 1), // 월간 YoY 가속폭 1%p면 이미 큰 변화
    isBellwether: true,
    type: "macro_indicator",
  });

  return {
    id: `ecos-cpi-${latest.time}`,
    source: { type: "ecos", ref_id: `cpi-${latest.time}`, url: "https://ecos.bok.or.kr/", tier: 1 },
    event_datetime: `${latest.time.slice(0, 4)}-${latest.time.slice(4, 6)}-01T12:00:00+09:00`, // 월간 통계라 일자 정보 없음
    collected_at: new Date().toISOString(),
    type: "macro_indicator",
    category: "소비자물가",
    subject: {
      entity_type: "macro",
      code: "KR-CPI",
      name: "소비자물가지수(CPI)",
      is_bellwether: true,
      sectors: sectors.map((s) => s.sector),
    },
    metrics: {
      cpi_yoy_pct: latestYoyPct,
      cpi_yoy_pct_prev_month: prevYoyPct,
      cpi_yoy_accel_pct_point: accelDeltaPct,
    },
    scoring,
    impact: {
      direction,
      strength: Math.abs(accelDeltaPct) >= 0.5 ? "strong" : Math.abs(accelDeltaPct) >= 0.2 ? "medium" : "weak",
      affected_sectors: sectors,
    },
    content: {
      meta_line: `소비자물가지수(CPI) · ${latest.time.slice(4, 6)}월 · 소비자물가`,
      headline: `소비자물가 전년동월대비 ${latestYoyPct}% (전월 ${prevYoyPct}%에서 ${direction === "up" ? "가속" : direction === "down" ? "둔화" : "유지"})`,
      chips: sectors.map((s) => `${s.sector}${s.direction === "up" ? "↑" : s.direction === "down" ? "↓" : "→"}`),
      horizon: buildCpiHorizon(direction, latestYoyPct),
    },
    reliability: { tier: 1, needs_review: false, corroboration_count: 0 },
    updates: [],
    status: "active",
  };
}
