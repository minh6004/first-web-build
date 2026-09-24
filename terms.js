// 이용약관 페이지 전용 스크립트. 다른 단순 페이지(login.js/signup.js)와
// 동일하게 로그인 상태 반영 + 모바일 네비 토글만 담당한다.
import { initNavAuth } from "./nav-auth.js";

// signup.html의 약관 미리보기 스크롤 박스가 이 페이지를 <iframe
// src="terms.html?embed=1">로 그대로 끌어다 쓴다. embed=1일 때는
// 헤더/푸터와 .legal-card 자체 보더를 숨겨서(legal.css의 .is-embedded 참고),
// 좁은 스크롤 박스 안에 로고/네비가 다시 나오거나 보더가 이중으로 겹치는
// 문제를 막는다.
if (new URLSearchParams(location.search).get("embed") === "1") {
  document.body.classList.add("is-embedded");
}

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});
