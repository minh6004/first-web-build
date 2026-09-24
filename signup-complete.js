// 회원가입 4단계(가입완료) 페이지 전용 스크립트. 3단계가 실제 계정 생성에
// 성공했을 때만 남기는 signupCompleted 플래그가 없으면, 가입을 마치지
// 않고 URL로 바로 들어온 것이므로 1단계로 되돌려보낸다.
import { initNavAuth } from "./nav-auth.js";

if (sessionStorage.getItem("signupCompleted") !== "true") {
  window.location.replace("signup.html");
  throw new Error("가입을 완료하지 않아 signup.html로 되돌립니다.");
}

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});
