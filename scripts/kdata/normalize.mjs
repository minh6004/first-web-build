// 관세청 품목별 수출입실적(월간, HS코드 단위 합계) -> 정규화 이벤트 스키마.
// 방향 판정은 다른 소스와 마찬가지로 scripts/lib/impact.mjs 공용 헬퍼만
// 쓴다 -- YoY 값이 없으면(전년 동월 데이터 없음) neutral로 안전하게 처리된다.
import { computeImpactFromMetrics, computeScoring, surpriseScoreFromValues } from "../lib/impact.mjs";

function yoyPct(current, prior) {
  if (current == null || prior == null || prior === 0) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10;
}

function formatYymm(yymm) {
  return `${yymm.slice(0, 4)}.${yymm.slice(4, 6)}`;
}

function buildHorizon(direction, sectorLabel, driverLabel) {
  if (direction === "up") {
    return {
      short_term: `${sectorLabel} ${driverLabel}이 전년 동월 대비 늘어나 관련 업종 심리에 단기적으로 긍정적일 수 있어요.`,
      long_term: "이 증가세가 다음 달에도 이어지는지가 중장기 업황 판단의 핵심이에요.",
    };
  }
  if (direction === "down") {
    return {
      short_term: `${sectorLabel} ${driverLabel}이 전년 동월 대비 줄어 관련 업종에 단기적으로 부담이 될 수 있어요.`,
      long_term: "일시적 둔화인지 추세적 하락인지 다음 달 실적과 함께 확인할 필요가 있어요.",
    };
  }
  return {
    short_term: `${sectorLabel} 수출입 실적이 전년 동월과 비슷한 수준이에요.`,
    long_term: "뚜렷한 방향성이 나타나는지 다음 달 발표를 지켜볼 필요가 있어요.",
  };
}

/**
 * @param {string} sectorName 예: "반도체"
 * @param {{hsCode: string, label: string, driver?: "export"|"import"}} hsInfo
 * @param {{yymm: string, total: {expDlr:number, impDlr:number, balPayments:number}}} latest
 * @param {{yymm: string, total: {expDlr:number, impDlr:number, balPayments:number}} | null} sameMonthLastYear
 */
export function normalizeCustomsEvent(sectorName, hsInfo, latest, sameMonthLastYear) {
  const exportYoyPct = yoyPct(latest.total.expDlr, sameMonthLastYear?.total.expDlr);
  const importYoyPct = yoyPct(latest.total.impDlr, sameMonthLastYear?.total.impDlr);

  // 원유(HS 2709) 같은 품목은 한국이 거의 수출하지 않아 수출액이 0에
  // 가깝다 -- 그 상태에서 수출 YoY를 대표 지표로 쓰면 "-100%" 같은 의미
  // 없는 값이 나온다. hs-code-watchlist.json에 driver: "import"로 표시된
  // 섹터는 수입 YoY를 대표 지표로 쓴다(기본값은 수출 YoY).
  const driver = hsInfo.driver === "import" ? "import" : "export";
  const primaryYoyPct = driver === "import" ? importYoyPct : exportYoyPct;
  const driverLabel = driver === "import" ? "수입" : "수출";

  const impact = computeImpactFromMetrics([primaryYoyPct], [sectorName], "수출입동향");
  const surpriseScore = surpriseScoreFromValues([exportYoyPct, importYoyPct]);
  const scoring = computeScoring({ surpriseScore, isBellwether: true, type: "macro_indicator" });

  const monthLabel = formatYymm(latest.yymm);
  const headline =
    primaryYoyPct != null
      ? `${sectorName}(HS ${hsInfo.hsCode}) ${driverLabel} 전년 동월 대비 ${primaryYoyPct >= 0 ? "+" : ""}${primaryYoyPct}%`
      : `${sectorName}(HS ${hsInfo.hsCode}) ${monthLabel} 수출입 실적 발표`;

  return {
    id: `kdata-${latest.yymm}-${hsInfo.hsCode}`,
    source: {
      type: "kdata",
      ref_id: `${hsInfo.hsCode}-${latest.yymm}`,
      url: "https://unipass.customs.go.kr/ets/index_.do",
      tier: 1,
    },
    // 관세청 통계는 "월" 단위라 일자 정보가 없다 -- 월초(1일) 정오(KST)로
    // 통일해서 채운다.
    event_datetime: `${latest.yymm.slice(0, 4)}-${latest.yymm.slice(4, 6)}-01T12:00:00+09:00`,
    collected_at: new Date().toISOString(),
    type: "macro_indicator",
    category: "수출입동향",
    subject: {
      entity_type: "sector",
      code: hsInfo.hsCode,
      name: `${sectorName}(${hsInfo.label})`,
      is_bellwether: true,
      sectors: [sectorName],
    },
    metrics: {
      export_value_usd: latest.total.expDlr,
      import_value_usd: latest.total.impDlr,
      trade_balance_usd: latest.total.balPayments,
      export_value_yoy_pct: exportYoyPct,
      import_value_yoy_pct: importYoyPct,
    },
    scoring,
    impact,
    content: {
      meta_line: `${sectorName} · ${monthLabel} · 수출입동향`,
      headline,
      chips: impact.affected_sectors.map(
        (s) => `${s.sector}${s.direction === "up" ? "↑" : s.direction === "down" ? "↓" : "→"}`
      ),
      horizon: buildHorizon(impact.direction, sectorName, driverLabel),
    },
    reliability: { tier: 1, needs_review: false, corroboration_count: 0 },
    updates: [],
    status: "active",
  };
}
