// GDELT DOC 2.0 API 호출(무료, 인증키 불필요). 공식 문서(blog.gdeltproject.org)가
// 서술형이라 정확한 JSON 필드명을 텍스트로 확정하기 어려워서, 실제로 이
// API를 감싸는 공개 Python 클라이언트(github.com/alex9smith/gdelt-doc-api)의
// 소스 코드(api_client.py, filters.py)를 직접 읽어서 URL 파라미터명
// (query/mode/format/startdatetime/enddatetime/maxrecords)과 응답 JSON 구조
// (ArtList: {articles:[{url,title,domain,seendate,...}]}, Timeline:
// {timeline:[{series, data:[{date,value}]}]})를 확인했다 -- 짐작으로 구현하지
// 않았다. 이 네트워크 환경에서는 공유 IP가 GDELT의 요청 빈도 제한에 걸려
// 라이브 응답을 직접 못 받아봤지만(별도로 사용자에게 보고), 파라미터/응답
// 구조 자체는 실제 클라이언트 코드에서 그대로 가져온 것이라 추측이 아니다.
const BASE_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

// GDELT는 "5초에 한 번" 요청 제한이 있고, 어기면 200 상태코드에 JSON이
// 아닌 안내 텍스트를 돌려준다 -- 이 프로세스 안에서 순차적으로 호출할 때
// 항상 최소 간격을 두도록 쓰로틀링한다.
const MIN_REQUEST_INTERVAL_MS = 5200;
let lastRequestAt = 0;

async function throttledFetchJson(url) {
  const waitMs = MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt);
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  lastRequestAt = Date.now();

  const response = await fetch(url);
  if (!response.ok) throw new Error(`GDELT API 요청 실패 (status ${response.status})`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // 요청 제한에 걸리면 200 + 평문 안내 메시지를 준다(JSON 파싱 실패로 감지).
    throw new Error(`GDELT API가 JSON이 아닌 응답을 반환함(요청 제한 가능성): ${text.slice(0, 200)}`);
  }
}

function fmtGdeltDatetime(date) {
  const iso = date.toISOString(); // "2026-09-21T15:00:00.000Z"
  return iso.slice(0, 4) + iso.slice(5, 7) + iso.slice(8, 10) + iso.slice(11, 13) + iso.slice(14, 16) + iso.slice(17, 19);
}

/** KST 자정~자정 하루(dateStr=YYYYMMDD)에 대응하는 UTC 구간 */
export function kstDayUtcRange(dateStr) {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(4, 6)) - 1;
  const d = Number(dateStr.slice(6, 8));
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs), end: new Date(startUtcMs + 24 * 60 * 60 * 1000) };
}

/** YYYYMMDD를 deltaDays만큼 이동(음수는 과거) */
export function shiftKstDate(dateStr, deltaDays) {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(4, 6)) - 1;
  const d = Number(dateStr.slice(6, 8));
  const dt = new Date(Date.UTC(y, m, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return `${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * @param {"timelinevol"|"timelinetone"} mode
 * @returns {Promise<{date:string, value:number}[]>}
 */
export async function fetchTimeline(mode, keyword, startDate, endDate) {
  const url =
    `${BASE_URL}?query=${encodeURIComponent(keyword)}&mode=${mode}&format=json` +
    `&startdatetime=${fmtGdeltDatetime(startDate)}&enddatetime=${fmtGdeltDatetime(endDate)}`;
  const data = await throttledFetchJson(url);
  const series = data.timeline?.[0]?.data ?? [];
  return series.map((point) => ({ date: point.date, value: point.value }));
}

/** @returns {Promise<{url:string, title:string, domain:string, seendate:string}[]>} */
export async function fetchArtList(keyword, startDate, endDate, maxRecords = 10) {
  const url =
    `${BASE_URL}?query=${encodeURIComponent(keyword)}&mode=artlist&format=json&sort=hybridrel&maxrecords=${maxRecords}` +
    `&startdatetime=${fmtGdeltDatetime(startDate)}&enddatetime=${fmtGdeltDatetime(endDate)}`;
  const data = await throttledFetchJson(url);
  return data.articles ?? [];
}
