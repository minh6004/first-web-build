// 회원가입 페이지 전용 스크립트. Firebase Authentication(이메일/비밀번호)으로
// 계정을 만들고, Firestore의 users/{uid} 문서에 닉네임/생년월일을 저장한다.
// 가입은 Gmail 주소만 허용하고, 가입 직후 인증 메일을 보낸 뒤 인증 전까지는
// 로그인 상태로 두지 않는다(로그인 게이팅은 login.js에서 다시 한번 확인함).
import {
  auth,
  db,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  doc,
  setDoc,
} from "./firebase-init.js";
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

const SIGNUP_ERROR_MESSAGES = {
  "auth/email-already-in-use": "이미 가입된 아이디(이메일)입니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
  "auth/network-request-failed": "네트워크 상태를 확인해 주세요.",
};

function describeSignupError(error) {
  return SIGNUP_ERROR_MESSAGES[error.code] || "가입 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

// Gmail 주소만 가입 허용 (예: 회사/학교 메일 등 다른 도메인은 여기서 막는다).
const GMAIL_PATTERN = /^[^\s@]+@gmail\.com$/i;

// 폼 제출: Firebase Auth 계정 생성 성공 시 Firestore에 프로필을 저장하고
// 인증 메일을 보낸 뒤, 인증 전까지는 로그인 상태로 두지 않기 위해 바로
// 로그아웃한다. 실패하면 에러 코드를 한글 메시지로 바꿔 보여준다.
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

  if (!GMAIL_PATTERN.test(email)) {
    signupMessage.textContent = "Gmail 주소만 가입 가능합니다.";
    signupMessage.classList.add("is-error");
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, "users", credential.user.uid), { nickname, birthdate });
    await sendEmailVerification(credential.user);
    await signOut(auth); // 인증 완료 전까지는 로그인 상태로 취급하지 않는다

    signupMessage.textContent = "입력하신 Gmail로 인증 메일을 보냈습니다. 메일함에서 링크를 클릭해 인증을 완료해주세요.";
    signupForm.reset();
    signupSubmit.disabled = true; // 체크박스도 초기화되었으니 다시 잠근다
  } catch (error) {
    console.error(error);
    signupMessage.textContent = describeSignupError(error);
    signupMessage.classList.add("is-error");
  }
});
