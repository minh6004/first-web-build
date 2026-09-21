// 연준 보도자료 -> 정규화 이벤트 스키마. 방향(direction) 판정은 항상
// scripts/lib/impact.mjs의 공용 헬퍼(computeDirection 등)를 거쳐서
// up/down/neutral 세 가지를 명시적으로 처리한다 -- "금리 동결"처럼 방향성이
// 뚜렷하지 않은 경우가 실제로 자주 나오는 소스라 이 원칙이 특히 중요하다.
import { fetchPressReleaseText } from "./fed-client.mjs";
import { computeScoring, surpriseScoreFromValues } from "../lib/impact.mjs";

// FOMC 성명서의 표준 문구("The Committee decided to raise/lower/maintain
// the target range for the federal funds rate...")를 찾아 인상/인하/동결과
// 인상폭(있으면)을 뽑아낸다. 문구를 못 찾으면(성명서가 아니거나 표현이
// 달라졌으면) neutral로 안전하게 되돌아간다 -- 절대 up/down 둘 중 하나로
// 억지로 단정하지 않는다.
const RATE_DECISION_PATTERN =
  /decided to (raise|lower|maintain) the target range for the federal funds rate(?: by ([\d/]+) percentage point)?/i;
const BP_BY_FRACTION = { "1/4": 25, "1/2": 50, "3/4": 75, "1": 100 };

function parseRateDecision(plainText) {
  const match = plainText.match(RATE_DECISION_PATTERN);
  if (!match) return { direction: "neutral", changeBp: null };

  const verb = match[1].toLowerCase();
  const direction = verb === "raise" ? "up" : verb === "lower" ? "down" : "neutral";
  const changeBp = match[2] ? (BP_BY_FRACTION[match[2]] ?? null) : null;
  return { direction, changeBp };
}

// 금리 결정의 방향에 따라 섹터별 반응은 반대로 갈리는 경우가 많다(금리
// 인상 -> 은행 마진 개선이지만 성장주·부동산엔 부담). 더미 데이터 시절
// 수기로 정리했던 것과 같은 논리를 실제 데이터 경로에도 그대로 적용한다.
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
  // 동결: 불확실성 해소로 완만하게 우호적인 경우가 많다는, 기존 더미
  // 데이터(한국은행 동결 이벤트)와 같은 해석을 재사용한다.
  return [
    { sector: "금융", direction: "neutral" },
    { sector: "성장주", direction: "up" },
  ];
}

// 주의: neutral == "성명서에서 방향을 못 찾음"과 "실제로 동결했음"은 다른
// 의미다. subtype이 statement일 때만 neutral을 "동결"로 해설한다 --
// projections/minutes 문서는 그 자체로 정책 액션이 아니라서, 같은 회의에서
// 실제로는 인상/인하가 있었더라도 이 문서 혼자만 보고 "동결"이라고 잘못
// 단정하면 안 된다(실제로 이 문제가 있었음 -- 2026-09-16 FOMC 성명서는
// 인상이었는데, 같이 나온 경제전망 발표에 동결용 문구가 잘못 붙었었다).
function buildHorizon(subtype, direction, changeBp) {
  if (subtype === "projections") {
    return {
      short_term: "경제전망(점도표) 공개로 향후 금리 경로에 대한 시장의 힌트가 늘어났어요.",
      long_term: "위원들의 금리 전망 중앙값이 실제 정책 결정에 어떻게 반영되는지 다음 회의까지 지켜볼 필요가 있어요.",
    };
  }
  if (subtype === "minutes") {
    return {
      short_term: "지난 회의의 상세 논의 내용이 공개돼 향후 정책 방향에 대한 추가 힌트를 줄 수 있어요.",
      long_term: "의사록에서 드러난 위원들 간 견해 차이가 다음 결정에 영향을 줄 수 있어요.",
    };
  }

  // subtype === "statement" -- 실제 정책 액션이므로 direction을 그대로 해설한다.
  if (direction === "up") {
    return {
      short_term: `기준금리를 ${changeBp ? `${changeBp}bp ` : ""}인상해 단기적으로 성장주·부동산 관련 자산에 부담이 될 수 있어요.`,
      long_term: "추가 인상 여부와 속도가 중장기적으로 시장 방향을 좌우할 핵심 변수예요.",
    };
  }
  if (direction === "down") {
    return {
      short_term: `기준금리를 ${changeBp ? `${changeBp}bp ` : ""}인하해 단기적으로 위험자산 선호 심리가 살아날 수 있어요.`,
      long_term: "인하 사이클이 얼마나 이어지는지가 중장기 자산 가격의 핵심 변수가 될 거예요.",
    };
  }
  return {
    short_term: "금리를 동결하면서 불확실성이 일부 해소돼 단기적으로는 안정적인 반응이 나올 수 있어요.",
    long_term: "다음 회의에서의 방향 전환 신호(포워드 가이던스)가 중장기적으로 더 중요해요.",
  };
}

// FOMC 성명서/경제전망(점도표)/의사록 정도만 이번 1차 구현에서 다룬다.
function classify(title) {
  if (/FOMC statement/i.test(title)) return { subtype: "statement", category: "통화정책" };
  if (/economic projections/i.test(title)) return { subtype: "projections", category: "통화정책(경제전망)" };
  if (/Minutes of the Federal Open Market Committee/i.test(title)) return { subtype: "minutes", category: "통화정책(의사록)" };
  return null; // 할인율 회의 의사록 등 이번 범위 밖인 보도자료는 제외
}

function formatMonthDay(pubDate) {
  const d = new Date(pubDate);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function normalizeFedPressRelease(item) {
  const classification = classify(item.title);
  if (!classification) return null;

  let direction = "neutral";
  let changeBp = null;
  let sectors = [{ sector: "금융", direction: "neutral" }];

  if (classification.subtype === "statement") {
    try {
      const text = await fetchPressReleaseText(item.link);
      ({ direction, changeBp } = parseRateDecision(text));
    } catch (error) {
      console.warn(`  ⚠ FOMC 성명서 본문 조회 실패: ${error.message}`);
    }
    sectors = rateDecisionSectorImpacts(direction);
  }
  // 경제전망(점도표)/의사록은 그 자체로 즉각적인 방향을 판단하기 어려워
  // neutral로 둔다 -- 억지로 up/down을 매기지 않는다.

  const surpriseScore = surpriseScoreFromValues([changeBp], 50);
  const scoring = computeScoring({ surpriseScore, isBellwether: true, type: "rate_decision" });

  const dateKey = new Date(item.pubDate).toISOString().slice(0, 10).replace(/-/g, "");
  const idSuffix = item.link.match(/(\d{8}[a-z])\.htm$/)?.[1] ?? dateKey;

  return {
    id: `fed-${idSuffix}`,
    source: { type: "fed", ref_id: idSuffix, url: item.link, tier: 1 },
    event_datetime: new Date(item.pubDate).toISOString(),
    collected_at: new Date().toISOString(),
    type: "rate_decision",
    category: classification.category,
    subject: {
      entity_type: "macro",
      code: "US-FED",
      name: "미국 연방준비제도(Fed)",
      is_bellwether: true,
      sectors: sectors.map((s) => s.sector),
    },
    metrics: changeBp != null ? { rate_change_bp: direction === "down" ? -changeBp : changeBp } : {},
    scoring,
    impact: { direction, strength: changeBp ? (changeBp >= 50 ? "strong" : "medium") : "weak", affected_sectors: sectors },
    content: {
      meta_line: `미국 연방준비제도(Fed) · ${formatMonthDay(item.pubDate)} · ${classification.category}`,
      headline: item.title,
      chips: sectors.map((s) => `${s.sector}${s.direction === "up" ? "↑" : s.direction === "down" ? "↓" : "→"}`),
      horizon: buildHorizon(classification.subtype, direction, changeBp),
    },
    reliability: { tier: 1, needs_review: false, corroboration_count: 0 },
    updates: [],
    status: "active",
  };
}
