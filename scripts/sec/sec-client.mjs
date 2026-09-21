// SEC EDGAR 수집. 키가 필요 없는 공개 엔드포인트지만, SEC의 공정 이용
// 정책상 연락처가 포함된 User-Agent 헤더가 필수다(없으면 차단될 수 있음).
//
// "getcurrent" 액션은 폼종류별 "가장 최근 N건"만 주는 재조회용 피드라
// 특정 날짜를 직접 지정할 수 없다 -- 넉넉한 개수를 가져와서 응답에 포함된
// "Filed: YYYY-MM-DD" 문자열로 원하는 날짜만 걸러낸다. 그 날짜가 최근
// N건 범위 밖이면(그 폼종류의 그날 건수가 매우 많았던 경우) 일부만 잡힐
// 수 있다는 한계가 있다 -- 1차 구현에서는 이 정도로 충분하다고 보고
// 넘어간다.
const USER_AGENT = "StockLens issue-briefing collector (contact: research@example.com)";
const FORM_TYPES = ["8-K", "10-Q", "10-K", "13F-HR"];
const FETCH_COUNT = 100;

function extractAttr(tag, attr) {
  const match = tag.match(new RegExp(`${attr}="([^"]*)"`));
  return match ? match[1] : null;
}

function decodeEntities(text) {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function parseAtomEntries(xml) {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  return entries.map((entryXml) => {
    const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
    const linkTag = entryXml.match(/<link[^>]*>/)?.[0] ?? "";
    const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const categoryTag = entryXml.match(/<category[^>]*>/)?.[0] ?? "";

    const title = titleMatch ? decodeEntities(titleMatch[1].trim()) : "";
    const summary = summaryMatch ? decodeEntities(summaryMatch[1]) : "";
    const filedMatch = summary.match(/Filed:<\/b>\s*(\d{4}-\d{2}-\d{2})/);

    // title 형식: "FORM - COMPANY NAME (CIK) (Filer)"
    const titleMatch2 = title.match(/^([\w.-]+)\s*-\s*(.+?)\s*\((\d{10})\)\s*\(Filer\)$/);

    return {
      formType: titleMatch2?.[1] ?? extractAttr(categoryTag, "term"),
      companyName: titleMatch2?.[2] ?? title,
      cik: titleMatch2?.[3] ?? null,
      link: extractAttr(linkTag, "href"),
      filedDate: filedMatch ? filedMatch[1] : null,
      summaryText: summary,
    };
  });
}

/** 지정한 폼종류의 "최근 N건" 중 filedDate가 목표 날짜(YYYY-MM-DD)와 일치하는 것만. */
async function fetchCurrentFilings(formType, targetDate) {
  const url = new URL("https://www.sec.gov/cgi-bin/browse-edgar");
  url.searchParams.set("action", "getcurrent");
  url.searchParams.set("type", formType);
  url.searchParams.set("company", "");
  url.searchParams.set("dateb", "");
  url.searchParams.set("owner", "include");
  url.searchParams.set("count", String(FETCH_COUNT));
  url.searchParams.set("output", "atom");

  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    throw new Error(`SEC EDGAR 요청 실패: ${formType} (status ${response.status})`);
  }
  const xml = await response.text();
  const entries = parseAtomEntries(xml);
  return entries.filter((entry) => entry.filedDate === targetDate);
}

/** 대상 날짜(YYYY-MM-DD)에 대해 8-K/10-Q/10-K/13F-HR을 전부 훑는다. */
export async function fetchSecFilingsForDate(isoDate) {
  const all = [];
  for (const formType of FORM_TYPES) {
    const filings = await fetchCurrentFilings(formType, isoDate);
    all.push(...filings);
  }
  return all;
}
