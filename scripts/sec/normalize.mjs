// SEC EDGAR 원본 필링(sec-client.mjs가 뽑아낸 항목) -> 정규화 이벤트 스키마.
// 방향 판정은 DART/Fed와 동일하게 scripts/lib/impact.mjs의 공용 헬퍼만
// 쓴다 -- 8-K/10-Q/10-K/13F-HR 전부 "이 필링 자체만으로는 상승/하락을
// 단정할 근거가 없는" 경우가 대부분이라, computeImpactFromMetrics가 항상
// neutral을 안전한 기본값으로 주는 동작이 특히 중요하다(임의로 up/down을
// 지어내지 않는다).
import { computeImpactFromMetrics, computeScoring, surpriseScoreFromValues } from "../lib/impact.mjs";

// 8-K는 폼 자체에 세부 유형이 없어서, 요약문에 찍히는 "Item X.XX" 코드로
// 대략적인 성격을 나눈다(실제 EDGAR getcurrent 응답에서 관찰한 패턴).
function classify8K(summaryText) {
  if (/Item 2\.0[1-6]/.test(summaryText)) return { type: "ma", category: "인수합병" };
  if (/Item 5\.0[1-3]/.test(summaryText)) return { type: "ma", category: "지배구조 변경" };
  if (/Item 1\.0[1-2]/.test(summaryText)) return { type: "contract", category: "주요계약" };
  return { type: "disclosure", category: "수시공시" };
}

function classifyFiling(formType, summaryText) {
  if (formType === "8-K") return classify8K(summaryText);
  if (formType === "10-Q" || formType === "10-K") {
    return { type: "earnings", category: formType === "10-K" ? "연차보고서" : "분기보고서" };
  }
  if (formType === "13F-HR") return { type: "disclosure", category: "기관보유현황(13F)" };
  return null;
}

function findBellwetherSectors(companyName, bellwetherMapUs) {
  const upper = companyName.toUpperCase();
  const sectors = [];
  for (const [sector, fragments] of bellwetherMapUs.entries()) {
    if (fragments.some((fragment) => upper.includes(fragment.toUpperCase()))) {
      sectors.push(sector);
    }
  }
  return sectors;
}

function buildHorizon(type) {
  if (type === "earnings") {
    return {
      short_term: "정기 재무 보고서가 공시돼 실적 세부 내용이 시장에 반영되기 시작할 수 있어요.",
      long_term: "보고서에 담긴 사업 부문별 흐름이 다음 분기 실적 전망에 어떤 영향을 주는지 지켜볼 필요가 있어요.",
    };
  }
  if (type === "ma") {
    return {
      short_term: "지배구조·인수합병 관련 공시는 단기적으로 주가 변동성을 키우는 경우가 많아요.",
      long_term: "거래·변화가 실제로 어떻게 마무리되는지가 중장기 관점에서 중요해요.",
    };
  }
  if (type === "contract") {
    return {
      short_term: "주요 계약 관련 공시는 단기적으로 시장의 관심을 끌 수 있어요.",
      long_term: "계약이 실제 실적에 기여하는 규모와 시점이 중장기 주가를 좌우해요.",
    };
  }
  return {
    short_term: "기관 보유 현황(13F) 공개는 대형 투자자들의 포지션 변화를 엿볼 수 있는 참고 자료예요.",
    long_term: "이 정보는 최대 45일 지연 공시라 실시간 포지션이 아니라는 점을 감안해서 봐야 해요.",
  };
}

/**
 * @param {object} filing sec-client.mjs가 뽑아낸 원본 항목
 * @param {Map<string, string[]>} bellwetherMapUs 섹터 -> 회사명 조각 배열
 */
export function normalizeSecFiling(filing, bellwetherMapUs) {
  if (!filing.cik) return null;

  const classification = classifyFiling(filing.formType, filing.summaryText);
  if (!classification) return null;

  const matchedSectors = findBellwetherSectors(filing.companyName, bellwetherMapUs);
  const isBellwether = matchedSectors.length > 0;
  const sectors = isBellwether ? matchedSectors : ["미분류"];

  // 현재는 EDGAR 요약만으로 실적 수치(YoY)를 뽑아내지 않는다 -- 10-Q/10-K의
  // 실제 재무 수치는 XBRL 조회가 별도로 필요해서 이번 소스 확장 범위 밖으로
  // 뒀다(다음 과제로 남김). metrics가 비어 있으니
  // computeImpactFromMetrics는 항상 neutral을 반환한다 -- 근거 없이
  // up/down을 지어내지 않기 위한 의도된 동작이다.
  const impact = computeImpactFromMetrics([], sectors, classification.category);
  const surpriseScore = surpriseScoreFromValues([]);
  const scoring = computeScoring({ surpriseScore, isBellwether, type: classification.type });

  return {
    id: `sec-${filing.cik}-${filing.link.match(/(\d{10}-\d{2}-\d{6})/)?.[1] ?? Date.now()}`,
    source: { type: "sec", ref_id: filing.cik, url: filing.link, tier: 1 },
    event_datetime: `${filing.filedDate}T16:00:00-04:00`, // EDGAR는 시각을 안 주므로 미 동부 마감 시각으로 대체
    collected_at: new Date().toISOString(),
    type: classification.type,
    category: classification.category,
    subject: {
      entity_type: "stock",
      code: filing.cik,
      name: filing.companyName,
      is_bellwether: isBellwether,
      sectors,
    },
    metrics: {},
    scoring,
    impact,
    content: {
      meta_line: `${filing.companyName} · ${filing.filedDate.slice(5).replace("-", ".")} · ${classification.category}`,
      headline: `${filing.companyName}, ${filing.formType} 공시`,
      chips: impact.affected_sectors.map(
        (s) => `${s.sector}${s.direction === "up" ? "↑" : s.direction === "down" ? "↓" : "→"}`
      ),
      horizon: buildHorizon(classification.type),
    },
    reliability: { tier: 1, needs_review: false, corroboration_count: 0 },
    updates: [],
    status: "active",
  };
}
