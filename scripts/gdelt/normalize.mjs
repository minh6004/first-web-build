// GDELT 언급량/톤 -> 정규화 이벤트 스키마. GDELT는 기사 본문을 제공하지
// 않는 이벤트/메타데이터 소스라 "특정 키워드 언급량이 평소보다 튀었는가
// (스파이크) + 그 보도의 평균 톤(긍정/부정)"만 화제성 신호로 쓴다.
//
// 2군(비공식) 소스라 reliability.tier: 2, needs_review: true로 표시하고,
// AI 검수 게이트(scripts/review/)를 통과해야 실제 발행 목록에 포함된다.
import { computeDirection, computeScoring, surpriseScoreFromValues } from "../lib/impact.mjs";
import { fetchTimeline, fetchArtList, kstDayUtcRange, shiftKstDate } from "./gdelt-client.mjs";

const BASELINE_DAYS = 7;
// 평소(최근 7일 평균) 대비 오늘 언급량이 1.5배 이상일 때만 "스파이크"로
// 본다 -- 이 기준 미만이면 그냥 평소 수준의 보도량이라 이벤트로 만들지 않는다.
const SPIKE_RATIO_THRESHOLD = 1.5;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function averageByDay(series) {
  const byDay = new Map();
  for (const point of series) {
    const day = point.date.slice(0, 8); // YYYYMMDDhhmmss -> YYYYMMDD
    const values = byDay.get(day) ?? [];
    values.push(point.value);
    byDay.set(day, values);
  }
  const result = new Map();
  for (const [day, values] of byDay) {
    result.set(day, values.reduce((a, b) => a + b, 0) / values.length);
  }
  return result;
}

function buzzStrength(spikeRatio) {
  if (spikeRatio >= 3) return "strong";
  if (spikeRatio >= 2) return "medium";
  return "weak";
}

function buildBuzzHorizon(direction, spikeRatio) {
  if (direction === "up") {
    return {
      short_term: `해외 매체의 관련 보도가 평소보다 ${spikeRatio}배 늘고 논조도 우호적이라, 단기적으로 시장의 관심이 커질 수 있어요.`,
      long_term: "이 관심이 실제 실적이나 정책 변화로 이어지는지가 중장기적으로 중요해요.",
    };
  }
  if (direction === "down") {
    return {
      short_term: `해외 매체의 관련 보도가 평소보다 ${spikeRatio}배 늘었지만 논조는 부정적이라, 단기적으로 우려가 커질 수 있어요.`,
      long_term: "이 우려가 실제 악재로 이어지는지, 일시적 논란인지 후속 보도를 지켜볼 필요가 있어요.",
    };
  }
  return {
    short_term: `해외 매체의 관련 보도량이 평소보다 ${spikeRatio}배 늘었지만 논조는 뚜렷하지 않아요.`,
    long_term: "보도가 어떤 방향으로 이어지는지 다음 보도를 지켜볼 필요가 있어요.",
  };
}

// GDELT는 너무 짧거나 흔한 단일 키워드를 거부한다("Your search contained a
// keyword that was too short" -- 실제 라이브 호출로 확인함, "금융"에서 발생).
// 공용 섹터 이름(data/bellwether-list.json, DART/네이버가 같이 씀)은 그대로
// 두고, GDELT에 보내는 질의어만 여기서 더 구체적인 문구로 바꾼다.
const GDELT_QUERY_OVERRIDES = {
  금융: "금융권",
  "IT/플랫폼": "IT 플랫폼", // 슬래시(/)가 쿼리 파서에서 특수문자로 오인될 수 있어 공백으로 대체
};

function toGdeltQuery(sectorName) {
  return GDELT_QUERY_OVERRIDES[sectorName] ?? sectorName;
}

/**
 * @param {string} sectorName 예: "반도체"
 * @param {string} dateStr YYYYMMDD(KST)
 * @returns {Promise<{event: object, evidence: object} | null>}
 */
export async function normalizeSectorBuzzCandidate(sectorName, dateStr) {
  const queryKeyword = toGdeltQuery(sectorName);
  const { start: todayStart, end: todayEnd } = kstDayUtcRange(dateStr);
  const baselineStartDateStr = shiftKstDate(dateStr, -BASELINE_DAYS);
  const { start: baselineStart } = kstDayUtcRange(baselineStartDateStr);

  const volSeries = await fetchTimeline("timelinevol", queryKeyword, baselineStart, todayEnd);
  const toneSeries = await fetchTimeline("timelinetone", queryKeyword, baselineStart, todayEnd);

  const volByDay = averageByDay(volSeries);
  const toneByDay = averageByDay(toneSeries);

  const todayVol = volByDay.get(dateStr);
  if (todayVol == null) return null; // 오늘치 데이터가 아직 없음

  const baselineDays = [...volByDay.keys()].filter((d) => d !== dateStr);
  if (baselineDays.length === 0) return null; // 비교할 과거 데이터가 없으면 스파이크를 판단할 수 없음

  const baselineAvg = baselineDays.reduce((sum, d) => sum + volByDay.get(d), 0) / baselineDays.length;
  if (baselineAvg <= 0) return null;

  const spikeRatio = round1(todayVol / baselineAvg);
  if (spikeRatio < SPIKE_RATIO_THRESHOLD) return null; // 평소 수준 -- 화제성 이벤트로 만들지 않음

  const todayTone = round1(toneByDay.get(dateStr) ?? 0);
  const direction = computeDirection(todayTone);
  const strength = buzzStrength(spikeRatio);

  const articles = await fetchArtList(queryKeyword, todayStart, todayEnd, 10);
  const distinctMedia = [...new Set(articles.map((a) => a.domain).filter(Boolean))];

  const scoring = computeScoring({
    // 3배 스파이크(=베이스라인 대비 +200%)면 포화 -- 회사 실적 YoY(50%)와는
    // 다른 스케일이라 별도로 맞춘 것(ECOS/kdata와 같은 원칙).
    surpriseScore: surpriseScoreFromValues([Math.round((spikeRatio - 1) * 100)], 200),
    isBellwether: true,
    type: "industry_news",
  });

  const event = {
    id: `gdelt-${dateStr}-${sectorName}`,
    source: { type: "gdelt", ref_id: `${sectorName}-${dateStr}`, url: "https://api.gdeltproject.org/api/v2/doc/doc", tier: 2 },
    event_datetime: `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T12:00:00+09:00`,
    collected_at: new Date().toISOString(),
    type: "industry_news",
    category: "뉴스 화제성",
    subject: {
      entity_type: "sector",
      code: sectorName,
      name: sectorName,
      is_bellwether: true,
      sectors: [sectorName],
    },
    metrics: {
      volume_share_pct: round1(todayVol),
      volume_baseline_pct: round1(baselineAvg),
      spike_ratio: spikeRatio,
      avg_tone: todayTone,
    },
    scoring,
    // 여기서 direction/chips는 "이 섹터 전체에 대한 해외 보도 논조"라는
    // 집계 신호다 -- 특정 개별 사건이 확인됐다는 뜻이 아니다(그건 네이버
    // 쪽 헤드라인 카드의 역할).
    impact: { direction, strength, affected_sectors: [{ sector: sectorName, direction }] },
    content: {
      meta_line: `${sectorName} · ${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)} · 뉴스 화제성`,
      headline: `"${sectorName}" 관련 해외 뉴스 언급량 평소 대비 ${spikeRatio}배 (톤 ${todayTone >= 0 ? "+" : ""}${todayTone})`,
      chips: [`${sectorName}${direction === "up" ? "↑" : direction === "down" ? "↓" : "→"}`],
      horizon: buildBuzzHorizon(direction, spikeRatio),
    },
    reliability: { tier: 2, needs_review: true, corroboration_count: distinctMedia.length },
    updates: [],
    status: "active",
  };

  const evidence = {
    source: "gdelt",
    sector: sectorName,
    volume_baseline_pct: round1(baselineAvg),
    volume_today_pct: round1(todayVol),
    spike_ratio: spikeRatio,
    avg_tone: todayTone,
    sample_headlines: articles.slice(0, 5).map((a) => a.title),
    media_domains: distinctMedia,
  };

  return { event, evidence };
}
