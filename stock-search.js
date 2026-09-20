// '주식 검색' 페이지 전용 스크립트. 실제 시세/분석 데이터 연동은 아직 없고,
// 더미 데이터를 기반으로 화면과 흐름만 구현한다. getTopMovers()/
// searchStocks()/getStockAnalysis() 세 함수만 나중에 실제 API 호출로
// 교체하면 되도록 분리해뒀다.
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

// 종목별 더미 분석 코멘트 -- 나중에 실제 분석 로직(예: 이슈 브리핑 데이터
// 연결)으로 교체할 때 이 함수 내부만 바꾸면 된다. 목록에 없는 종목은 기본
// 문구("최근 이 종목에 영향을 준 이벤트가 없습니다")로 대체한다.
function getStockAnalysis(name) {
  const dummyInsights = {
    엔비디아: "최근 이 종목은 AI 반도체 수요 확대 이슈의 영향을 받고 있어요.",
    삼성전자: "최근 이 종목은 반도체 업황 회복 기대감의 영향을 받고 있어요.",
    LG에너지솔루션: "최근 이 종목은 배터리 소재 가격 변동 이슈의 영향을 받고 있어요.",
    셀트리온: "최근 이 종목은 바이오시밀러 관련 실적 기대감의 영향을 받고 있어요.",
    신한지주: "최근 이 종목은 기준금리 관련 이슈의 영향을 받고 있어요.",
  };
  return dummyInsights[name] || "최근 이 종목에 영향을 준 이벤트가 없습니다.";
}

const resultList = document.getElementById("stockResultList");
const emptyMessage = document.getElementById("stockEmptyMessage");
const analysisPanel = document.getElementById("stockAnalysis");
const analysisTitle = document.getElementById("stockAnalysisTitle");
const analysisText = document.getElementById("stockAnalysisText");

function hideAnalysis() {
  analysisPanel.hidden = true;
  analysisTitle.textContent = "";
  analysisText.textContent = "";
}

function showAnalysis(name) {
  analysisTitle.textContent = name;
  analysisText.textContent = getStockAnalysis(name);
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
      showAnalysis(stock.name);
    });

    item.appendChild(button);
    resultList.appendChild(item);
  });
}

const searchInput = document.getElementById("stockSearchInput");
const marketFilter = document.getElementById("marketFilter");
const sectorFilter = document.getElementById("sectorFilter");

function runSearch() {
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
