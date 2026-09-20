// '나의 계좌' 페이지 전용 스크립트. 실제 증권사 API 연동은 아직 없고, 화면과
// 안내 흐름만 구현한다. isAccountLinked()/connectAccount() 두 함수만 나중에
// 실제 연동 로직으로 바꿔 끼우면 되도록 분리해뒀다.
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// 계좌 연동 여부 확인 -- 실제 증권사 API 연동을 붙일 때 이 함수가 실제 연동
// 상태를 반환하도록 바꾸면 된다. 지금은 항상 미연동 상태.
function isAccountLinked() {
  return false;
}

const accountEmptyState = document.getElementById("accountEmptyState");
const accountLinkedState = document.getElementById("accountLinkedState");

function renderAccountState() {
  const linked = isAccountLinked();
  accountEmptyState.hidden = linked;
  accountLinkedState.hidden = !linked;
}

const toast = document.getElementById("accountToast");
let toastTimer = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3000);
}

// 계좌 연동 버튼 클릭 처리 -- 실제 증권사 API 연동을 붙일 때 이 함수 안을
// 실제 연동 플로우 호출로 교체하면 된다. 지금은 준비 중 안내만 띄운다.
function connectAccount() {
  showToast("계좌 연동 기능은 준비 중입니다.");
}

document.getElementById("connectAccountBtn").addEventListener("click", connectAccount);

renderAccountState();
