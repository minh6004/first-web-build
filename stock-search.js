// '주식 검색' 페이지 전용 스크립트. 실제 시세/재무/이벤트 데이터 연동은
// 아직 없고, 더미 데이터를 기반으로 화면과 흐름만 구현한다. getTopMovers()/
// searchStocks()/getStockMetrics()/getRelatedEvents() 네 함수만 나중에
// 실제 API(시세, 재무, 이슈 브리핑 이벤트)로 교체하면 되도록 분리해뒀다.
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// 더미 종목 리스트 -- market은 "domestic"(국내)/"overseas"(해외), sector는
// 필터 드롭다운의 옵션 값과 그대로 맞춘다. 실제로는 이 배열 대신 시세 API
// 조회 결과가 들어갈 자리.
const STOCKS = [
  { name: "삼성전자", market: "domestic", sector: "반도체" },
  { name: "SK하이닉스", market: "domestic", sector: "반도체" },
  { name: "카카오", market: "domestic", sector: "IT/플랫폼" },
  { name: "네이버", market: "domestic", sector: "IT/플랫폼" },
  { name: "엔비디아", market: "overseas", sector: "반도체" },
  { name: "애플", market: "overseas", sector: "IT/플랫폼" },
  { name: "테슬라", market: "overseas", sector: "2차전지" },
  { name: "LG에너지솔루션", market: "domestic", sector: "2차전지" },
  { name: "현대차", market: "domestic", sector: "2차전지" },
  { name: "셀트리온", market: "domestic", sector: "바이오" },
  { name: "삼성바이오로직스", market: "domestic", sector: "바이오" },
  { name: "마이크로소프트", market: "overseas", sector: "IT/플랫폼" },
  { name: "구글", market: "overseas", sector: "IT/플랫폼" },
  { name: "아마존", market: "overseas", sector: "IT/플랫폼" },
  { name: "POSCO홀딩스", market: "domestic", sector: "에너지" },
  { name: "신한지주", market: "domestic", sector: "금융" },
];

const MARKET_LABELS = { domestic: "국내", overseas: "해외" };

// ---------------------------------------------------------------------------
// 왼쪽: 오늘의 등락 현황판
// ---------------------------------------------------------------------------

// 더미 데이터 -- 나중에 실제 시세 API로 교체할 때 이 함수 내부만 바꾸면 된다.
function getTopMovers() {
  return {
    gainers: [
      { name: "엔비디아", change: 5.82 },
      { name: "셀트리온", change: 3.41 },
      { name: "LG에너지솔루션", change: 2.97 },
      { name: "카카오", change: 2.15 },
      { name: "POSCO홀딩스", change: 1.88 },
    ],
    losers: [
      { name: "삼성바이오로직스", change: -3.62 },
      { name: "신한지주", change: -2.74 },
      { name: "현대차", change: -2.1 },
      { name: "테슬라", change: -1.85 },
      { name: "네이버", change: -1.32 },
    ],
  };
}

function renderMoverList(listEl, movers, direction) {
  listEl.innerHTML = "";
  movers.forEach((mover, index) => {
    const item = document.createElement("li");
    item.className = "mover-item";
    item.innerHTML = `
      <span class="mover-rank">${index + 1}</span>
      <span class="mover-name">${mover.name}</span>
      <span class="mover-change ${direction}">${mover.change > 0 ? "+" : ""}${mover.change.toFixed(2)}%</span>
    `;
    listEl.appendChild(item);
  });
}

const { gainers, losers } = getTopMovers();
renderMoverList(document.getElementById("gainerList"), gainers, "up");
renderMoverList(document.getElementById("loserList"), losers, "down");

// ---------------------------------------------------------------------------
// 오른쪽: 종목 검색 + 필터 + 분석
// ---------------------------------------------------------------------------

// 검색 로직 -- 나중에 실제 시세 API로 교체할 때 이 함수 내부만 바꾸면 된다.
// 지금은 더미 리스트에서 검색어 포함 여부 + 국내/해외 + 섹터 조건만 확인한다.
function searchStocks(query, filters = {}) {
  const trimmed = query.trim();
  const { market = "all", sector = "all" } = filters;

  return STOCKS.filter((stock) => {
    if (trimmed && !stock.name.includes(trimmed)) return false;
    if (market !== "all" && stock.market !== market) return false;
    if (sector !== "all" && stock.sector !== sector) return false;
    return true;
  });
}

// 핵심 지표 더미 값 -- 나중에 실제 재무 API로 교체할 때 이 함수 내부만
// 바꾸면 된다. 종목명 길이로 살짝 변주만 줘서 다 똑같아 보이지 않게 했을
// 뿐, 실제 값과는 무관하다.
function getStockMetrics(name) {
  const seed = name.length;
  return {
    per: `${(12 + seed * 1.3).toFixed(1)}배`,
    pbr: `${(0.8 + seed * 0.12).toFixed(2)}배`,
    roe: `${(6 + seed * 0.7).toFixed(1)}%`,
    marketCap: `${Math.round(20 + seed * 15)}조원`,
  };
}

// 섹터별 더미 관련 이벤트(1~2개) -- 이슈 브리핑 페이지에 실제로 있는
// 이벤트 중 해당 섹터와 맞아떨어지는 것을 그대로 옮겨왔다. 나중에는 여기
// 대신 이슈 브리핑의 실제 이벤트 데이터에서 섹터가 일치하는 항목을 조회하는
// 로직으로 바뀔 자리. 매핑이 없는 섹터(바이오/IT·플랫폼)는 빈 배열을
// 반환해 "최근 관련 이벤트가 없습니다"가 자연스럽게 뜨도록 둔다.
const RELATED_EVENTS_BY_SECTOR = {
  반도체: [
    {
      org: "엔비디아",
      decision: "3분기 실적 발표 (매출 시장 예상치 상회)",
      chips: [
        { sector: "반도체", direction: "up" },
        { sector: "AI", direction: "up" },
      ],
    },
    {
      org: "TSMC",
      decision: "첨단 공정 가동률 상승 발표",
      chips: [
        { sector: "반도체", direction: "up" },
        { sector: "파운드리", direction: "up" },
      ],
    },
  ],
  "2차전지": [
    {
      org: "중국 배터리 업체",
      decision: "국내 시장 저가 공세 심화",
      chips: [
        { sector: "2차전지", direction: "down" },
        { sector: "배터리소재", direction: "down" },
      ],
    },
  ],
  금융: [
    {
      org: "한국은행",
      decision: "기준금리 동결 결정",
      chips: [
        { sector: "은행주", direction: "up" },
        { sector: "성장주", direction: "up" },
      ],
    },
  ],
  에너지: [
    {
      org: "국내 정유사",
      decision: "3분기 정제마진 개선 발표",
      chips: [
        { sector: "정유", direction: "up" },
        { sector: "화학", direction: "up" },
      ],
    },
  ],
  바이오: [],
  "IT/플랫폼": [],
};

function getRelatedEvents(sector) {
  return RELATED_EVENTS_BY_SECTOR[sector] || [];
}

const resultList = document.getElementById("stockResultList");
const emptyMessage = document.getElementById("stockEmptyMessage");
const analysisPanel = document.getElementById("stockAnalysis");
const analysisTitle = document.getElementById("stockAnalysisTitle");
const metricTiles = document.getElementById("stockMetricTiles");
const relatedEventList = document.getElementById("relatedEventList");
const relatedEventsEmpty = document.getElementById("relatedEventsEmpty");

function hideAnalysis() {
  analysisPanel.hidden = true;
  analysisTitle.textContent = "";
  metricTiles.innerHTML = "";
  relatedEventList.innerHTML = "";
  relatedEventsEmpty.hidden = true;
}

function renderMetricTiles(metrics) {
  metricTiles.innerHTML = `
    <div class="metric-tile"><span class="metric-label">PER</span><span class="metric-value">${metrics.per}</span></div>
    <div class="metric-tile"><span class="metric-label">PBR</span><span class="metric-value">${metrics.pbr}</span></div>
    <div class="metric-tile"><span class="metric-label">ROE</span><span class="metric-value">${metrics.roe}</span></div>
    <div class="metric-tile"><span class="metric-label">시가총액</span><span class="metric-value">${metrics.marketCap}</span></div>
  `;
}

function renderRelatedEvents(events) {
  relatedEventList.innerHTML = "";

  if (events.length === 0) {
    relatedEventsEmpty.hidden = false;
    return;
  }

  relatedEventsEmpty.hidden = true;
  events.forEach((event) => {
    const item = document.createElement("li");
    item.className = "related-event";
    const chipsHtml = event.chips
      .map((chip) => `<span class="related-chip ${chip.direction}">${chip.sector}${chip.direction === "up" ? "↑" : "↓"}</span>`)
      .join("");
    item.innerHTML = `
      <span class="related-event-line">${event.org} ${event.decision}</span>
      <span class="related-event-chips">${chipsHtml}</span>
    `;
    relatedEventList.appendChild(item);
  });
}

function showAnalysis(stock) {
  analysisTitle.textContent = stock.name;
  renderMetricTiles(getStockMetrics(stock.name));
  renderRelatedEvents(getRelatedEvents(stock.sector));
  analysisPanel.hidden = false;
}

function renderResults(stocks) {
  resultList.innerHTML = "";
  hideAnalysis(); // 목록이 바뀌면 이전에 선택했던 종목 분석은 초기화한다

  if (stocks.length === 0) {
    emptyMessage.hidden = false;
    return;
  }

  emptyMessage.hidden = true;
  stocks.forEach((stock) => {
    const item = document.createElement("li");
    item.className = "stock-result-item card";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "stock-result-button";
    button.innerHTML = `
      <span class="stock-result-name">${stock.name}</span>
      <span class="stock-result-meta">${MARKET_LABELS[stock.market]} · ${stock.sector}</span>
    `;
    button.addEventListener("click", () => {
      resultList.querySelectorAll(".stock-result-item.is-selected").forEach((el) => el.classList.remove("is-selected"));
      item.classList.add("is-selected");
      showAnalysis(stock);
    });

    item.appendChild(button);
    resultList.appendChild(item);
  });
}

const searchInput = document.getElementById("stockSearchInput");
const marketFilter = document.getElementById("marketFilter");
const sectorFilter = document.getElementById("sectorFilter");

function runSearch() {
  // 검색어를 입력하기 전에는 결과 상자를 아예 띄우지 않는다 -- 검색을
  // 시작해야 그때 결과(또는 "검색 결과가 없습니다")가 나타난다.
  if (!searchInput.value.trim()) {
    resultList.innerHTML = "";
    emptyMessage.hidden = true;
    hideAnalysis();
    return;
  }

  renderResults(
    searchStocks(searchInput.value, {
      market: marketFilter.value,
      sector: sectorFilter.value,
    })
  );
}

searchInput.addEventListener("input", runSearch);
marketFilter.addEventListener("change", runSearch);
sectorFilter.addEventListener("change", runSearch);

runSearch();
