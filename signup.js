// 이 폼은 Formspree로 데이터를 전송만 할 뿐, 실제 로그인 인증 기능은 없음.
// 비밀번호가 평문으로 전송되므로 실서비스 전환 시 별도 인증 백엔드(예: Firebase
// Auth, Supabase Auth) 및 비밀번호 해싱 도입이 필요함.

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// 약관 동의 체크 전에는 가입하기 버튼을 비활성 상태로 둔다.
const agreeCheckbox = document.getElementById("agreeTerms");
const signupSubmit = document.getElementById("signupSubmit");

agreeCheckbox.addEventListener("change", () => {
  signupSubmit.disabled = !agreeCheckbox.checked;
});

// 약관 보기 -- 모달 대신 인라인 아코디언으로 더미 약관을 펼친다.
const termsToggle = document.getElementById("termsToggle");
const termsPanel = document.getElementById("termsPanel");

termsToggle.addEventListener("click", () => {
  const isOpen = termsPanel.classList.toggle("is-open");
  termsToggle.setAttribute("aria-expanded", String(isOpen));
  termsPanel.inert = !isOpen;
});

// 폼 제출: 페이지 이동 없이 fetch로 Formspree에 전송하고 결과 메시지만 표시한다.
const signupForm = document.getElementById("signupForm");
const signupMessage = document.getElementById("signupMessage");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signupMessage.textContent = "";
  signupMessage.classList.remove("is-error");

  try {
    const response = await fetch(signupForm.action, {
      method: signupForm.method,
      body: new FormData(signupForm),
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      signupMessage.textContent = "가입 신청이 접수되었습니다.";
      signupForm.reset();
      signupSubmit.disabled = true; // 체크박스도 초기화되었으니 다시 잠근다
    } else {
      signupMessage.textContent = "가입 신청에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      signupMessage.classList.add("is-error");
    }
  } catch (error) {
    signupMessage.textContent = "가입 신청에 실패했습니다. 네트워크 상태를 확인해 주세요.";
    signupMessage.classList.add("is-error");
  }
});
