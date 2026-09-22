// 공공데이터포털 "관세청_품목별 수출입실적(GW)" API 호출.
// 엔드포인트/파라미터는 문서 페이지가 이미지로만 스펙을 제공해서 텍스트로
// 긁을 수 없었고, 사용자가 data.go.kr 마이페이지에서 직접 확인해 준 샘플
// URL로 실제 검증했다:
//   https://apis.data.go.kr/1220000/Itemtrade/getItemtradeList
//     ?serviceKey=...&strtYymm=YYYYMM&endYymm=YYYYMM&hsSgn=HS코드
//
// hsSgn에 2/4/6/10자리 HS코드를 넣으면 그 코드로 시작하는 모든 하위
// 품목이 각각 한 행씩 나오고, 마지막에 그 전체를 합산한 "총계" 행이
// 추가로 붙는다(year="총계", hsCode="-"). 섹터 단위로 보려면 하위 품목을
// 일일이 더할 필요 없이 이 "총계" 행 하나만 쓰면 된다 -- 실제로 라이브
// 호출로 총계 행이 개별 행들의 합과 정확히 일치함을 확인했다.
const BASE_URL = "https://apis.data.go.kr/1220000/Itemtrade/getItemtradeList";

function getApiKey() {
  const key = process.env.DATA_GO_KR_API_KEY;
  if (!key) {
    throw new Error("DATA_GO_KR_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return key;
}

function extractField(itemXml, tag) {
  return itemXml.match(new RegExp(`<${tag}>(.*?)</${tag}>`))?.[1] ?? null;
}

/**
 * 지정한 HS코드(prefix)·연월(YYYYMM)의 수출입 합계("총계" 행)를 가져온다.
 * 데이터가 없는 달(아직 발표 전 등)이면 null을 반환한다 -- 위조하지 않는다.
 */
export async function fetchItemTradeTotal(hsCode, yymm) {
  const url = new URL(BASE_URL);
  url.searchParams.set("serviceKey", getApiKey());
  url.searchParams.set("strtYymm", yymm);
  url.searchParams.set("endYymm", yymm);
  url.searchParams.set("hsSgn", hsCode);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`관세청 API 요청 실패: HS ${hsCode} ${yymm} (status ${response.status})`);
  }
  const xml = await response.text();

  const resultCode = xml.match(/<resultCode>(.*?)<\/resultCode>/)?.[1];
  if (resultCode && resultCode !== "00") {
    const resultMsg = xml.match(/<resultMsg>(.*?)<\/resultMsg>/)?.[1] ?? "알 수 없는 오류";
    throw new Error(`관세청 API 에러 [${resultCode}] ${resultMsg} (HS ${hsCode} ${yymm})`);
  }

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const totalItem = items.find((item) => extractField(item, "year") === "총계");
  if (!totalItem) return null;

  return {
    expDlr: Number(extractField(totalItem, "expDlr")),
    impDlr: Number(extractField(totalItem, "impDlr")),
    balPayments: Number(extractField(totalItem, "balPayments")),
  };
}

function shiftYymm(yymm, monthsBack) {
  let year = Number(yymm.slice(0, 4));
  let month = Number(yymm.slice(4, 6)) - monthsBack;
  while (month <= 0) {
    month += 12;
    year -= 1;
  }
  return `${year}${String(month).padStart(2, "0")}`;
}

/**
 * 관세청 통계는 매월 중순쯤 전월 실적이 확정 발표되는 식이라, "이번 달"을
 * 바로 조회하면 아직 데이터가 없을 수 있다. 최신 달부터 몇 달 전까지
 * 순서대로 내려가며 데이터가 있는 첫 달을 찾는다.
 */
export async function findLatestAvailableMonth(hsCode, referenceYymm, maxMonthsBack = 4) {
  for (let back = 0; back <= maxMonthsBack; back += 1) {
    const yymm = shiftYymm(referenceYymm, back);
    const total = await fetchItemTradeTotal(hsCode, yymm);
    if (total) return { yymm, total };
  }
  return null;
}

export { shiftYymm };
