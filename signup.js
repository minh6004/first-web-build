// 회원가입 1단계(약관 동의) 페이지 전용 스크립트. 여기서는 계정을 만들지
// 않는다 -- 실제 가입 폼/제출은 뒤쪽 단계에서 처리한다. 이 단계의 역할은
// "필수 항목(이용약관/개인정보처리방침/만 14세 이상) 셋 다 확인해야만
// 다음으로 넘어갈 수 있다"를 강제하는 것뿐이다.
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const agreeTermsCheckbox = document.getElementById("agreeTerms");
const agreePrivacyCheckbox = document.getElementById("agreePrivacy");
const agreeAge14Checkbox = document.getElementById("agreeAge14");
const nextStepBtn = document.getElementById("nextStepBtn");
const stepMessage = document.getElementById("stepMessage");

function allRequiredChecked() {
  return agreeTermsCheckbox.checked && agreePrivacyCheckbox.checked && agreeAge14Checkbox.checked;
}

function refreshNextStepAvailability() {
  nextStepBtn.disabled = !allRequiredChecked();
  stepMessage.textContent = "";
}

agreeTermsCheckbox.addEventListener("change", refreshNextStepAvailability);
agreePrivacyCheckbox.addEventListener("change", refreshNextStepAvailability);
agreeAge14Checkbox.addEventListener("change", refreshNextStepAvailability);

nextStepBtn.addEventListener("click", () => {
  if (!allRequiredChecked()) {
    // 버튼이 disabled라 정상적으로는 여기 도달하지 않지만, 혹시 모를 우회에
    // 대비해 한 번 더 확인하고 안내 메시지를 보여준다.
    stepMessage.textContent = "이용약관, 개인정보처리방침, 만 14세 이상 확인에 모두 동의해야 다음 단계로 진행할 수 있습니다.";
    return;
  }
  // 뒤 단계들이 이 값을 확인해서, 1단계를 안 거치고 URL로 바로 들어온 접근을
  // 걸러낸다(signup-info.js/signup-verify.js/signup-complete.js 참고).
  sessionStorage.setItem("signupTermsAgreed", "true");
  window.location.href = "signup-info.html";
});
