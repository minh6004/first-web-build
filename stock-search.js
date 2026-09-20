// '주식 검색' 페이지 전용 스크립트. 실제 시세 API 연동은 아직 없고, 더미
// 종목 리스트를 검색어로 필터링하는 화면만 구현한다. STOCKS 배열과
// searchStocks()만 나중에 실제 API 호출로 교체하면 되도록 분리해뒀다.
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// 더미 종목 리스트. 실제로는 이 배열 대신 시세 API 조회 결과가 들어갈 자리.
const STOCKS = [
  "삼성전자",
  "SK하이닉스",
  "카카오",
  "네이버",
  "엔비디아",
  "애플",
  "테슬라",
  "LG에너지솔루션",
  "현대차",
  "셀트리온",
  "삼성바이오로직스",
  "마이크로소프트",
  "구글",
  "아마존",
  "POSCO홀딩스",
];

// 검색 로직 -- 나중에 실제 시세 API로 교체할 때 이 함수 내부만 바꾸면 된다.
// 지금은 더미 리스트에서 종목명에 검색어가 포함되는지만 확인한다.
function searchStocks(query) {
  const trimmed = query.trim();
  if (!trimmed) return STOCKS;
  return STOCKS.filter((name) => name.includes(trimmed));
}

const resultList = document.getElementById("stockResultList");
const emptyMessage = document.getElementById("stockEmptyMessage");

function renderResults(names) {
  resultList.innerHTML = "";

  if (names.length === 0) {
    emptyMessage.hidden = false;
    return;
  }

  emptyMessage.hidden = true;
  names.forEach((name) => {
    const item = document.createElement("li");
    item.className = "stock-result-item card";
    item.textContent = name;
    resultList.appendChild(item);
  });
}

const searchInput = document.getElementById("stockSearchInput");

searchInput.addEventListener("input", () => {
  renderResults(searchStocks(searchInput.value));
});

renderResults(searchStocks(""));
