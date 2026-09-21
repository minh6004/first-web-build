// 연준(Federal Reserve) 보도자료 수집. 키가 필요 없는 공개 RSS 피드라서
// DART처럼 인증 헤더가 없다. XML 파서 라이브러리를 새로 추가하지 않고,
// 이 피드의 고정된 태그 구조(<item><title>/<link>/<pubDate>/<category>,
// CDATA로 감싸져 있음)만 정규식으로 뽑아 쓴다 -- 범용 XML 파서가 필요할
// 만큼 복잡한 문서가 아니다.
const FED_MONETARY_FEED = "https://www.federalreserve.gov/feeds/press_monetary.xml";
const USER_AGENT = "StockLens issue-briefing collector (contact: research@example.com)";

function extractTag(itemXml, tag) {
  const match = itemXml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return match ? match[1].trim() : null;
}

/** RSS 2.0 <item> 블록들을 {title, link, pubDate, category}[] 로 뽑아낸다. */
function parseRssItems(xml) {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items.map((itemXml) => ({
    title: extractTag(itemXml, "title"),
    link: extractTag(itemXml, "link"),
    pubDate: extractTag(itemXml, "pubDate"),
    category: extractTag(itemXml, "category"),
  }));
}

/** YYYYMMDD 문자열로 변환(KST 기준 날짜 비교용). */
function toDateKey(pubDate) {
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  // 연준 보도자료는 워싱턴DC 시각(ET) 기준이라 KST로 변환하면 발표 다음날로
  // 넘어가는 경우가 흔하다(예: 현지 오후 2시 발표 = 한국 새벽). 1차
  // 구현에서는 "발표된 UTC 날짜"를 그대로 날짜 키로 쓴다 -- 정교한 시간대
  // 보정은 나중 과제로 남겨둔다.
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** 지정한 날짜(YYYYMMDD)에 발표된 통화정책 보도자료만 걸러서 가져온다. */
export async function fetchFedPressReleasesForDate(dateStr) {
  const response = await fetch(FED_MONETARY_FEED, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`연준 RSS 피드 요청 실패 (status ${response.status})`);
  }
  const xml = await response.text();
  const items = parseRssItems(xml);
  return items.filter((item) => toDateKey(item.pubDate) === dateStr);
}

/** 보도자료 본문 페이지에서 태그를 걷어낸 순수 텍스트를 가져온다. */
export async function fetchPressReleaseText(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`연준 보도자료 페이지 요청 실패: ${url} (status ${response.status})`);
  }
  const html = await response.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
