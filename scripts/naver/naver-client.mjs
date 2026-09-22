// NAVER API HUB(네이버 클라우드 플랫폼) 뉴스 검색 API 호출.
// 2026-06-25에 레거시 openapi.naver.com/v1/search/news.json(X-Naver-Client-Id/
// Secret 헤더)에서 naverapihub.apigw.ntruss.com(X-NCP-APIGW-API-KEY-ID/
// X-NCP-APIGW-API-KEY 헤더)으로 이관됐다 -- 실제 키로 라이브 호출해서
// 응답 형태(items[].title/originallink/link/description/pubDate, 레거시와
// 동일)까지 확인했다.
const BASE_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news";

function getCredentials() {
  const keyId = process.env.NCP_API_KEY_ID;
  const key = process.env.NCP_API_KEY;
  if (!keyId || !key) {
    throw new Error("NCP_API_KEY_ID / NCP_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return { keyId, key };
}

function stripHtml(text) {
  return text.replace(/<\/?b>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

/**
 * @param {{query:string, display?:number, sort?:"date"|"sim"}} params
 * @returns {Promise<{title:string, originalLink:string, link:string, description:string, pubDate:string}[]>}
 */
export async function searchNews({ query, display = 10, sort = "date" }) {
  const { keyId, key } = getCredentials();
  const url = new URL(BASE_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("display", String(display));
  url.searchParams.set("sort", sort);

  const response = await fetch(url, {
    headers: { "X-NCP-APIGW-API-KEY-ID": keyId, "X-NCP-APIGW-API-KEY": key },
  });
  if (!response.ok) {
    throw new Error(`네이버 뉴스 검색 API 요청 실패: "${query}" (status ${response.status})`);
  }
  const data = await response.json();
  const items = data.items ?? [];

  return items.map((item) => ({
    title: stripHtml(item.title),
    originalLink: item.originallink || item.link,
    link: item.link,
    description: stripHtml(item.description),
    pubDate: item.pubDate,
  }));
}
