// 회원가입 페이지 전용 스크립트. Firebase Authentication(이메일/비밀번호)으로
// 계정을 만들고, Firestore의 users/{uid} 문서에 닉네임/생년월일을 저장한다.
import { auth, db, createUserWithEmailAndPassword, doc, setDoc } from "./firebase-init.js";
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

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

const SIGNUP_ERROR_MESSAGES = {
  "auth/email-already-in-use": "이미 가입된 아이디(이메일)입니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
  "auth/network-request-failed": "네트워크 상태를 확인해 주세요.",
};

function describeSignupError(error) {
  return SIGNUP_ERROR_MESSAGES[error.code] || "가입 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

// 폼 제출: Firebase Auth 계정 생성 성공 시 Firestore에 프로필을 저장하고,
// 실패하면 에러 코드를 한글 메시지로 바꿔 보여준다.
const signupForm = document.getElementById("signupForm");
const signupMessage = document.getElementById("signupMessage");

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signupMessage.textContent = "";
  signupMessage.classList.remove("is-error");

  const nickname = document.getElementById("nickname").value.trim();
  const birthdate = document.getElementById("birthdate").value;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("signupPassword").value;

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", credential.user.uid), { nickname, birthdate });

    signupMessage.textContent = "가입 신청이 접수되었습니다.";
    signupForm.reset();
    signupSubmit.disabled = true; // 체크박스도 초기화되었으니 다시 잠근다
  } catch (error) {
    console.error(error);
    signupMessage.textContent = describeSignupError(error);
    signupMessage.classList.add("is-error");
  }
});
