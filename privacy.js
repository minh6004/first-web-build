// 개인정보처리방침 페이지 전용 스크립트. terms.js와 동일한 패턴 --
// 로그인 상태 반영 + 모바일 네비 토글, 그리고 signup.html이 이 페이지를
// <iframe src="privacy.html?embed=1">로 끌어다 쓸 때 헤더/푸터를 숨기는
// embed 모드까지 동일하게 지원한다(legal.css의 .is-embedded 참고).
import { initNavAuth } from "./nav-auth.js";

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
