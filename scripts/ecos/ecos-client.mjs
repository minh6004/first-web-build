// 한국은행 ECOS(경제통계시스템) Open API 호출.
// 엔드포인트/파라미터 순서는 문서(ecos.bok.or.kr/api)가 서술식이라 텍스트로
// 명확히 확인하기 어려웠지만, ECOS 자체 메타데이터 서비스(StatisticItemList)와
// 실제 데이터 서비스(StatisticSearch)를 실제 키로 라이브 호출해서 URL 형식과
// 통계표코드/항목코드를 직접 검증했다(추측 없음):
//   https://ecos.bok.or.kr/api/StatisticSearch/{인증키}/json/kr/{시작건수}/{종료건수}/{통계표코드}/{주기}/{검색시작}/{검색종료}/{항목코드1}
// 성공 시 { StatisticSearch: { row: [...] } }, 실패/데이터없음 시
// { RESULT: { CODE, MESSAGE } } 형태로 응답한다(DART/data.go.kr과 또 다른
// 컨벤션이라 그 코드들을 복붙하면 안 된다).
const BASE_URL = "https://ecos.bok.or.kr/api/StatisticSearch";

function getApiKey() {
  const key = process.env.ECOS_API_KEY;
  if (!key) throw new Error("ECOS_API_KEY 환경변수가 설정되어 있지 않습니다.");
  return key;
}

/**
 * @param {{statCode:string, cycle:"D"|"M", startDate:string, endDate:string, itemCode1:string, count?:number}} params
 * @returns {Promise<{time:string, value:number}[]>} TIME 오름차순 정렬
 */
export async function fetchStatisticSearch({ statCode, cycle, startDate, endDate, itemCode1, count = 30 }) {
  const key = getApiKey();
  const url = `${BASE_URL}/${key}/json/kr/1/${count}/${statCode}/${cycle}/${startDate}/${endDate}/${itemCode1}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ECOS API 요청 실패: ${statCode} (status ${response.status})`);
  }
  const data = await response.json();

  if (data.RESULT) {
    // INFO-200 = "해당하는 데이터가 없습니다" -- 에러가 아니라 그 기간에
    // 발표된 값이 아직 없다는 정상 상황이라 빈 배열로 처리한다.
    if (data.RESULT.CODE === "INFO-200") return [];
    throw new Error(`ECOS API 에러 [${data.RESULT.CODE}] ${data.RESULT.MESSAGE} (${statCode})`);
  }

  const rows = data.StatisticSearch?.row ?? [];
  return rows
    .map((row) => ({ time: row.TIME, value: Number(row.DATA_VALUE) }))
    .sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
}

/** YYYYMMDD 문자열을 달력일 기준으로 이동(뒤로는 음수) */
export function shiftDateDays(dateStr, days) {
  const y = Number(dateStr.slice(0, 4));
  const m = Number(dateStr.slice(4, 6)) - 1;
  const d = Number(dateStr.slice(6, 8));
  const dt = new Date(Date.UTC(y, m, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** YYYYMM 문자열을 개월 기준으로 이동(뒤로는 음수) */
export function shiftMonths(yymm, months) {
  let year = Number(yymm.slice(0, 4));
  let month = Number(yymm.slice(4, 6)) - months;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return `${year}${String(month).padStart(2, "0")}`;
}
