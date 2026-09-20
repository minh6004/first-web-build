// DART Open API 호출 전담 모듈. Node 18+ 내장 fetch만 쓰고 외부 패키지는
// 추가하지 않는다(이 저장소는 빌드 도구 없는 정적 사이트라는 원칙을 데이터
// 수집 스크립트에도 최대한 유지).
//
// 참고: 종목코드-고유번호 매핑 API(corpCode.xml, zip)는 이번 1차 구현에서는
// 쓰지 않는다 -- list.json 응답 자체에 corp_code가 이미 포함되어 있어서
// (재무제표 API 호출에 필요한 값이 바로 나옴), 별도로 zip을 내려받아 파싱할
// 필요가 없었다. 나중에 종목코드 목록 전체를 훑어야 하는 다른 용도가
// 생기면 그때 추가하면 된다.

const DART_BASE = "https://opendart.fss.or.kr/api";

function getApiKey() {
  const key = process.env.DART_API_KEY;
  if (!key) {
    throw new Error("DART_API_KEY 환경변수가 설정되어 있지 않습니다. (예: export DART_API_KEY=발급받은키)");
  }
  return key;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dartGet(endpoint, params) {
  const url = new URL(`${DART_BASE}/${endpoint}`);
  url.searchParams.set("crtfc_key", getApiKey());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DART API HTTP 오류: ${endpoint} (status ${response.status})`);
  }

  const data = await response.json();
  // DART API는 요청 자체가 실패해도 HTTP 200을 주고 status 코드로 결과를
  // 구분한다. 013은 "조회된 데이터가 없음"으로, 에러가 아니라 정상적인
  // 빈 결과로 취급한다.
  if (data.status && data.status !== "000") {
    if (data.status === "013") {
      return { ...data, list: [] };
    }
    throw new Error(`DART API 에러 [${data.status}] ${data.message ?? ""} (${endpoint})`);
  }
  return data;
}

/**
 * 특정 날짜(YYYYMMDD)의 공시 목록을 공시유형 하나에 대해 조회한다.
 * pblntfTy 코드: A=정기공시, B=주요사항보고, C=발행공시, D=지분공시,
 * E=기타공시, I=거래소공시(수시공시 상당수가 여기 포함됨).
 */
export async function fetchDisclosureList({ date, pblntfTy, pageNo = 1, pageCount = 100 }) {
  return dartGet("list.json", {
    bgn_de: date,
    end_de: date,
    pblntf_ty: pblntfTy,
    page_no: pageNo,
    page_count: pageCount,
  });
}

// 이번 1차 구현에서 다루는 공시유형. 스펙의 1~5번 데이터 항목(정기공시/
// 주요사항보고서/수시공시/잠정실적/지분공시)과 매칭된다. 거래소(I)는
// "단일판매·공급계약 체결/특허권 취득/임상시험 결과/대규모 설비투자" 같은
// 수시공시가 실제로 걸리는 코드라 포함했다. 펀드(G)/자산유동화(H)/
// 외부감사(F)/공정위(J)는 스펙 범위 밖이라 뺐다.
export const TARGET_DISCLOSURE_TYPES = ["A", "B", "C", "D", "E", "I"];

/** 하루치 대상 공시유형을 전부 훑어서 원본 목록을 합친다. */
export async function fetchAllDisclosuresForDate(date, { onProgress } = {}) {
  const all = [];
  for (const pblntfTy of TARGET_DISCLOSURE_TYPES) {
    let pageNo = 1;
    for (;;) {
      const data = await fetchDisclosureList({ date, pblntfTy, pageNo });
      const list = data.list || [];
      all.push(...list);
      onProgress?.({ pblntfTy, pageNo, count: list.length, totalCount: data.total_count ?? 0 });

      const totalPage = Number(data.total_page || 1);
      if (pageNo >= totalPage) break;
      pageNo += 1;
      await sleep(250); // DART API에 과도하게 연속 호출하지 않기 위한 최소한의 대기
    }
    await sleep(250);
  }
  return all;
}

/**
 * 단일회사 전체 재무제표 조회. reprt_code: 11011=사업보고서, 11012=반기보고서,
 * 11013=1분기보고서, 11014=3분기보고서. fs_div: CFS=연결, OFS=별도.
 */
export async function fetchFinancials({ corpCode, businessYear, reportCode, fsDiv }) {
  return dartGet("fnlttSinglAcntAll.json", {
    corp_code: corpCode,
    bsns_year: businessYear,
    reprt_code: reportCode,
    fs_div: fsDiv,
  });
}
