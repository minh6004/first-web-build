// 네이버뉴스(API HUB) 검색 결과 -> 정규화 이벤트 스키마.
// 지시사항: 헤드라인/발행매체/링크/짧은 스니펫만 그대로 쓰고 본문을
// 재구성하지 않는다 -- headline은 기사 제목 원문 그대로, description은
// API가 주는 스니펫 그대로만 쓴다.
//
// 감성(긍정/부정) 분석 기능이 없는 API라서, direction을 임의로 추정하지
// 않고 항상 "neutral"로 둔다(방향을 지어내지 않는다는 이 파이프라인의
// 원칙). 대신 "얼마나 여러 매체가 같은 주제를 다루는가"(corroboration)를
// strength로 반영해서, 화제성 자체는 신호로 살린다.
//
// 2군(비공식) 소스라 reliability.tier: 2, needs_review: true로 표시하고,
// AI 검수 게이트(scripts/review/)를 통과해야만 실제 발행 목록에 포함된다.
// 그 검수가 "카드 주장이 증거로 뒷받침되는가"를 판단할 수 있도록, 정규화된
// event 옆에 원본 증거(evidence)를 별도로 함께 반환한다 -- evidence는
// 최종 저장되는 event 스키마에는 포함되지 않는, 검수 전용 데이터다.
import { searchNews } from "./naver-client.mjs";
import { computeScoring, surpriseScoreFromValues } from "../lib/impact.mjs";

const MONTH_MAP = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };

// RFC822 "Tue, 22 Sep 2026 18:42:00 +0900" -> 각 조각을 직접 뽑아 쓴다.
// new Date()로 왕복시키지 않는 이유: 이 프로젝트에서 실제로 겪었던
// "로컬/UTC 변환 과정에서 날짜가 하루 밀리는" 버그(issue-briefing.js의
// toKstDateLabel 관련)를 반복하지 않기 위해, 원본 문자열의 날짜 조각을
// 그대로 신뢰하는 쪽을 택한다.
function parsePubDate(pubDate) {
  const m = pubDate.match(/^\w+, (\d{1,2}) (\w{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})$/);
  if (!m) return null;
  const [, day, mon, year, hh, mm, ss, offset] = m;
  const ymd = `${year}${MONTH_MAP[mon]}${day.padStart(2, "0")}`;
  const offsetFormatted = `${offset.slice(0, 3)}:${offset.slice(3)}`;
  const iso = `${year}-${MONTH_MAP[mon]}-${day.padStart(2, "0")}T${hh}:${mm}:${ss}${offsetFormatted}`;
  return { ymd, iso };
}

function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// "금융"/"반도체" 같은 섹터 키워드는 그 자체로 아주 흔한 단어라서, 그냥
// "오늘 이 키워드가 들어간 기사를 낸 서로 다른 매체 수"를 세면 전혀
// 무관한 기사들(지역 소상공인 지원, 공정위 발표 등)까지 다 같이 잡혀서
// "여러 매체가 교차 확인했다"는 주장이 거짓이 된다. 제목을 토큰화해서
// 비슷한 제목끼리만 같은 "이야기"로 묶고, 그 묶음 크기를 corroboration_count로
// 쓴다 -- 실제 텍스트 유사도 라이브러리 없이도 충분히 정직한 근사치다.
function normalizeTitle(title) {
  return title
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase()
    .trim();
}

function titleTokens(title) {
  return new Set(normalizeTitle(title).split(/\s+/).filter((t) => t.length >= 2));
}

function jaccard(setA, setB) {
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

const TITLE_SIMILARITY_THRESHOLD = 0.34;

/** 각 기사마다 "제목이 비슷한 다른 기사들"을 찾아 클러스터를 만들고,
 *  가장 큰 클러스터의 대표 기사를 오늘의 대표 이슈로 선택한다. */
function clusterBySimilarTitle(articles) {
  const tokenSets = articles.map((a) => titleTokens(a.title));
  let bestIndex = 0;
  let bestCluster = [0];

  for (let i = 0; i < articles.length; i += 1) {
    const cluster = [i];
    for (let j = 0; j < articles.length; j += 1) {
      if (i === j) continue;
      if (jaccard(tokenSets[i], tokenSets[j]) >= TITLE_SIMILARITY_THRESHOLD) cluster.push(j);
    }
    if (cluster.length > bestCluster.length) {
      bestCluster = cluster;
      bestIndex = i;
    }
  }

  return { top: articles[bestIndex], clusterArticles: bestCluster.map((idx) => articles[idx]) };
}

// 오늘 같은 섹터를 다룬 서로 다른 매체 수 -- 5개 이상이면 여러 매체가
// 동시에 다루는 화제성 있는 이슈, 1개뿐이면 단일 출처 보도.
function strengthByMediaCount(count) {
  if (count >= 5) return "strong";
  if (count >= 2) return "medium";
  return "weak";
}

/**
 * @param {string} sectorName 예: "반도체"
 * @param {string} dateStr YYYYMMDD(KST)
 * @returns {Promise<{event: object, evidence: object} | null>}
 */
export async function normalizeSectorNewsCandidate(sectorName, dateStr) {
  const articles = await searchNews({ query: sectorName, display: 20, sort: "date" });

  const todays = articles
    .map((a) => ({ ...a, parsed: parsePubDate(a.pubDate) }))
    .filter((a) => a.parsed && a.parsed.ymd === dateStr);
  if (todays.length === 0) return null; // 오늘 이 섹터를 다룬 기사가 없음

  const { top, clusterArticles } = clusterBySimilarTitle(todays);
  const distinctMedia = [...new Set(clusterArticles.map((a) => domainOf(a.originalLink)))];
  const corroborationCount = distinctMedia.length;
  const strength = strengthByMediaCount(corroborationCount);

  const scoring = computeScoring({
    surpriseScore: surpriseScoreFromValues([corroborationCount], 8), // 8개 매체 이상이면 포화
    isBellwether: true,
    type: "industry_news",
  });

  const event = {
    id: `naver-${dateStr}-${sectorName}`,
    source: { type: "naver", ref_id: `${sectorName}-${dateStr}`, url: top.link, tier: 2 },
    event_datetime: top.parsed.iso,
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
    metrics: { article_count: todays.length, distinct_media_count: corroborationCount },
    scoring,
    impact: {
      direction: "neutral", // 감성 분석 없이 방향을 지어내지 않는다
      strength,
      affected_sectors: [{ sector: sectorName, direction: "neutral" }],
    },
    content: {
      meta_line: `${sectorName} 관련 뉴스 · ${dateStr.slice(4, 6)}.${dateStr.slice(6, 8)} · 뉴스 화제성`,
      headline: top.title,
      chips: [`${sectorName}→`],
      horizon: {
        short_term: "이 뉴스가 단기 주가에 미칠 영향은 아직 명확하지 않아요 -- 후속 보도와 시장 반응을 함께 확인할 필요가 있어요.",
        long_term: "여러 매체가 같은 내용을 이어서 다루는지가 중장기적으로 신뢰도를 판단하는 기준이 될 수 있어요.",
      },
    },
    reliability: { tier: 2, needs_review: true, corroboration_count: corroborationCount },
    updates: [],
    status: "active",
  };

  const evidence = {
    source: "naver",
    sector: sectorName,
    // 대표 기사(top)와 같은 이야기로 묶인 기사들만 근거로 넘긴다 -- 오늘
    // 이 섹터 키워드가 들어간 무관한 기사까지 근거인 것처럼 보이면 안 된다.
    headlines: clusterArticles.slice(0, 5).map((a) => a.title),
    snippets: clusterArticles.slice(0, 5).map((a) => a.description),
    media_domains: distinctMedia,
    corroboration_count: corroborationCount,
  };

  return { event, evidence };
}
