// 원본 DART 공시(list.json 항목)를 스펙에 정의된 정규화 이벤트 스키마로
// 바꾸는 모듈: 분류 -> (실적이면) 재무제표 조회 -> 영향/스코어링/문구 생성.
import { fetchFinancials } from "./dart-client.mjs";

// ---------------------------------------------------------------------------
// 1. 공시 제목 기반 분류
// ---------------------------------------------------------------------------

// 스펙이 명시한 4개 type만 쓴다: earnings/disclosure/ma/contract.
// 매칭되지 않는 공시(정정신고, 첨부 서식, 안내공시 등)는 null을 반환해서
// 수집 단계에서 걸러낸다.
function classifyDisclosure(reportName) {
  if (/사업보고서|반기보고서|분기보고서|잠정실적/.test(reportName)) {
    return { type: "earnings", category: "기업실적" };
  }
  if (/합병|분할|영업양수|영업양도/.test(reportName)) {
    return { type: "ma", category: "인수합병" };
  }
  if (/단일판매|공급계약|특허권|임상시험|설비투자/.test(reportName)) {
    return { type: "contract", category: "수시공시" };
  }
  if (/대량보유상황보고서|주식등의대량보유|소유상황보고서/.test(reportName)) {
    return { type: "disclosure", category: "지분공시" };
  }
  if (/유상증자|무상증자|전환사채|신주인수권부사채|교환사채|자기주식/.test(reportName)) {
    return { type: "disclosure", category: "주요사항" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 2. 정기공시 -> 재무제표 조회(매출액/영업이익/당기순이익 YoY)
// ---------------------------------------------------------------------------

const REPORT_CODE_BY_KEYWORD = [
  { pattern: /사업보고서/, code: "11011" },
  { pattern: /반기보고서/, code: "11012" },
  { pattern: /1분기보고서/, code: "11013" },
  { pattern: /3분기보고서/, code: "11014" },
];

function guessReportCode(reportName) {
  return REPORT_CODE_BY_KEYWORD.find(({ pattern }) => pattern.test(reportName))?.code ?? null;
}

const ACCOUNT_ALIASES = {
  revenue: ["매출액", "수익(매출액)", "영업수익"],
  operatingProfit: ["영업이익", "영업이익(손실)"],
  netIncome: ["당기순이익", "당기순이익(손실)", "분기순이익", "반기순이익"],
};

function findAccount(rows, aliases) {
  return rows.find((row) => aliases.includes((row.account_nm || "").trim()));
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function yoyPct(current, prior) {
  if (current == null || prior == null || prior === 0) return null;
  return Math.round(((current - prior) / Math.abs(prior)) * 1000) / 10; // 소수 첫째 자리
}

/**
 * 정기공시 한 건에 대해 매출액/영업이익/당기순이익 YoY를 조회한다.
 * 연결(CFS) 재무제표를 우선 시도하고, 데이터가 없으면 별도(OFS)로 재시도한다.
 * "잠정실적" 공시처럼 사업/반기/분기보고서 형식이 아니면 재무제표 API로
 * 조회할 수 없으므로 null을 반환하고 metrics 없이 진행한다.
 */
export async function fetchEarningsMetrics({ corpCode, reportName, filingDate }) {
  const reportCode = guessReportCode(reportName);
  if (!reportCode) return null;

  const businessYear = filingDate.slice(0, 4);

  for (const fsDiv of ["CFS", "OFS"]) {
    try {
      const data = await fetchFinancials({ corpCode, businessYear, reportCode, fsDiv });
      const rows = data.list || [];
      if (rows.length === 0) continue;

      const revenueRow = findAccount(rows, ACCOUNT_ALIASES.revenue);
      const opRow = findAccount(rows, ACCOUNT_ALIASES.operatingProfit);
      const niRow = findAccount(rows, ACCOUNT_ALIASES.netIncome);
      if (!revenueRow && !opRow && !niRow) continue;

      const revenue = toNumber(revenueRow?.thstrm_amount);
      const revenuePrior = toNumber(revenueRow?.frmtrm_amount);
      const opProfit = toNumber(opRow?.thstrm_amount);
      const opProfitPrior = toNumber(opRow?.frmtrm_amount);
      const netIncome = toNumber(niRow?.thstrm_amount);
      const netIncomePrior = toNumber(niRow?.frmtrm_amount);

      return {
        revenue_yoy_pct: yoyPct(revenue, revenuePrior),
        operating_profit_yoy_pct: yoyPct(opProfit, opProfitPrior),
        net_income_yoy_pct: yoyPct(netIncome, netIncomePrior),
        fs_div: fsDiv,
      };
    } catch (error) {
      console.warn(`  ⚠ 재무제표 조회 실패(${fsDiv}, ${corpCode}): ${error.message}`);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3. 영향(impact)/스코어링(scoring)/문구(content) 생성 -- 전부 규칙 기반
// ---------------------------------------------------------------------------

function computeImpact(type, category, metrics, sectors) {
  const primary = metrics.operating_profit_yoy_pct ?? metrics.revenue_yoy_pct ?? metrics.net_income_yoy_pct ?? null;

  let direction = "neutral";
  if (primary != null) {
    direction = primary > 0 ? "up" : primary < 0 ? "down" : "neutral";
  }

  const absVal = primary != null ? Math.abs(primary) : 0;
  const strength = absVal >= 20 ? "strong" : absVal >= 5 ? "medium" : "weak";

  return {
    direction,
    strength,
    affected_sectors: sectors.map((sector) => ({ sector, direction, note: category })),
  };
}

function computeScoring(type, metrics, isBellwether) {
  const yoyValues = [metrics.revenue_yoy_pct, metrics.operating_profit_yoy_pct, metrics.net_income_yoy_pct].filter(
    (value) => value != null
  );
  const maxAbsYoy = yoyValues.length ? Math.max(...yoyValues.map(Math.abs)) : 0;
  // 초안 가중치: |YoY| 50%면 서프라이즈 점수 1.0으로 포화. 나중에 실제
  // 컨센서스 데이터가 들어오면 이 자리를 대체한다.
  const surpriseScore = Math.min(maxAbsYoy / 50, 1);

  let priority = surpriseScore * 60;
  if (isBellwether) priority += 25;
  if (type === "ma") priority += 10;
  if (type === "contract") priority += 5;
  priority = Math.round(Math.min(priority, 100));

  return {
    surprise_score: Math.round(surpriseScore * 100) / 100,
    price_trigger: false,
    price_change_pct: null,
    watchlist_boost: false,
    priority_score: priority,
  };
}

function formatMonthDay(filingDate) {
  return `${filingDate.slice(4, 6)}.${filingDate.slice(6, 8)}`;
}

// 이벤트 유형별 단기/중장기 해설 템플릿 -- 숫자만 끼워 넣는 규칙 기반.
function buildHorizon(type, metrics) {
  if (type === "earnings") {
    const op = metrics.operating_profit_yoy_pct;
    if (op != null && op > 0) {
      return {
        short_term: `영업이익이 전년 대비 ${op}% 증가해 단기적으로 긍정적인 주가 반응이 나올 수 있어요.`,
        long_term: "이 증가세가 다음 분기에도 이어지는지가 중장기 주가의 핵심 변수가 될 거예요.",
      };
    }
    if (op != null && op < 0) {
      return {
        short_term: `영업이익이 전년 대비 ${Math.abs(op)}% 감소해 단기적으로 주가에 부담이 될 수 있어요.`,
        long_term: "실적 부진이 일시적인지 추세적인지에 따라 중장기 주가 방향이 갈릴 수 있어요.",
      };
    }
    return {
      short_term: "실적 발표 내용이 아직 시장에 충분히 반영되지 않았을 수 있어요.",
      long_term: "다음 분기 실적 흐름을 함께 지켜볼 필요가 있어요.",
    };
  }

  if (type === "ma") {
    return {
      short_term: "인수합병·분할 관련 공시는 단기적으로 주가 변동성을 키우는 경우가 많아요.",
      long_term: "거래가 실제로 완료되는지, 사업 구조가 어떻게 재편되는지가 중장기 관점에서 중요해요.",
    };
  }

  if (type === "contract") {
    return {
      short_term: "신규 계약·특허·임상 관련 공시는 단기 기대감으로 이어지는 경우가 많아요.",
      long_term: "계약 규모가 실적에 실질적으로 기여하는 시점과 폭이 중장기 주가를 좌우해요.",
    };
  }

  return {
    short_term: "자본 변동·지분 관련 공시는 단기적으로 주가에 직접적인 영향을 줄 수 있어요.",
    long_term: "지분 구조나 자본 조달 목적이 중장기적으로 어떤 의미를 갖는지 살펴볼 필요가 있어요.",
  };
}

function buildContent({ type, category, corpName, reportName, filingDate, metrics, affectedSectors }) {
  const metaLine = `${corpName} · ${formatMonthDay(filingDate)} · ${category}`;

  let headline = `${corpName}, ${reportName}`;
  if (type === "earnings" && metrics.operating_profit_yoy_pct != null) {
    const sign = metrics.operating_profit_yoy_pct >= 0 ? "증가" : "감소";
    headline = `${corpName}, 영업이익 전년 대비 ${Math.abs(metrics.operating_profit_yoy_pct)}% ${sign}`;
  }

  const chips = affectedSectors.map(
    (s) => `${s.sector}${s.direction === "up" ? "↑" : s.direction === "down" ? "↓" : "→"}`
  );

  return { meta_line: metaLine, headline, chips, horizon: buildHorizon(type, metrics) };
}

// ---------------------------------------------------------------------------
// 4. 진입점: 원본 공시 한 건 -> 정규화된 이벤트 (또는 null)
// ---------------------------------------------------------------------------

/**
 * @param {object} raw list.json의 원본 공시 항목
 * @param {Map<string, {sectors: string[]}>} bellwetherMap 종목코드 -> 섹터 정보
 */
export async function normalizeDisclosure(raw, bellwetherMap) {
  if (!raw.stock_code) return null; // 비상장 법인 공시 제외(주식투자자용 사이트)

  const classification = classifyDisclosure(raw.report_nm);
  if (!classification) return null;

  const bellwetherInfo = bellwetherMap.get(raw.stock_code);
  const sectors = bellwetherInfo?.sectors?.length ? bellwetherInfo.sectors : ["미분류"];
  const isBellwether = Boolean(bellwetherInfo);

  let metrics = {};
  if (classification.type === "earnings") {
    const financials = await fetchEarningsMetrics({
      corpCode: raw.corp_code,
      reportName: raw.report_nm,
      filingDate: raw.rcept_dt,
    });
    if (financials) metrics = financials;
  }

  const impact = computeImpact(classification.type, classification.category, metrics, sectors);
  const scoring = computeScoring(classification.type, metrics, isBellwether);
  const content = buildContent({
    type: classification.type,
    category: classification.category,
    corpName: raw.corp_name,
    reportName: raw.report_nm,
    filingDate: raw.rcept_dt,
    metrics,
    affectedSectors: impact.affected_sectors,
  });

  return {
    id: `dart-${raw.rcept_dt}-${raw.rcept_no.slice(-6)}`,
    source: {
      type: "dart",
      ref_id: raw.rcept_no,
      url: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${raw.rcept_no}`,
      tier: 1,
    },
    // DART 공시 목록 API는 접수 "시각"까지는 주지 않고 날짜(YYYYMMDD)만
    // 준다. 시간 정보가 없어 정오(12:00 KST)를 임시로 채워둔다 -- 실제
    // 접수 시각이 필요해지면 공시 상세 조회 API를 추가로 붙여야 한다.
    event_datetime: `${raw.rcept_dt.slice(0, 4)}-${raw.rcept_dt.slice(4, 6)}-${raw.rcept_dt.slice(6, 8)}T12:00:00+09:00`,
    collected_at: new Date().toISOString(),
    type: classification.type,
    category: classification.category,
    subject: {
      entity_type: "stock",
      code: raw.stock_code,
      name: raw.corp_name,
      is_bellwether: isBellwether,
      sectors,
    },
    metrics,
    scoring,
    impact,
    content,
    reliability: { tier: 1, needs_review: false, corroboration_count: 0 },
    updates: [],
    status: "active",
  };
}
