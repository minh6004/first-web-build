// 이용약관 페이지 전용 스크립트. 다른 단순 페이지(login.js/signup.js)와
// 동일하게 로그인 상태 반영 + 모바일 네비 토글만 담당한다.
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});
