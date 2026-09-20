// 로그인 페이지 전용 스크립트. 백엔드가 없어 실제 인증은 불가능하므로,
// 제출 시 페이지 이동/alert 없이 콘솔에만 입력값을 기록한다.

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const loginForm = document.getElementById("loginForm");

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(loginForm));
  console.log("[로그인 시도 - 실제 인증 없음]", values);
});
