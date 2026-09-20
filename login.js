// 로그인 페이지 전용 스크립트. Firebase Authentication(이메일/비밀번호)으로
// 실제 로그인을 수행한다. 이메일 인증(sendEmailVerification)이 끝나지 않은
// 계정은 인증에는 성공해도 로그인 상태로 전환하지 않는다.
import { auth, signInWithEmailAndPassword, sendEmailVerification, signOut } from "./firebase-init.js";
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

const LOGIN_ERROR_MESSAGES = {
  "auth/invalid-credential": "아이디 또는 비밀번호가 올바르지 않습니다.",
  "auth/wrong-password": "비밀번호가 틀렸습니다.",
  "auth/user-not-found": "가입되지 않은 아이디입니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/too-many-requests": "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
  "auth/network-request-failed": "네트워크 상태를 확인해 주세요.",
};

function describeLoginError(error) {
  return LOGIN_ERROR_MESSAGES[error.code] || "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const resendVerificationBtn = document.getElementById("resendVerificationBtn");

// 이메일 인증이 안 된 상태로 로그인을 시도한 사용자 -- "인증 메일 다시
// 보내기" 버튼이 이 참조로 재발송을 시도한다(로그인 자체는 막았으므로
// auth.currentUser는 이미 비어 있다).
let pendingUnverifiedUser = null;

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  loginMessage.classList.remove("is-error");
  resendVerificationBtn.hidden = true;
  pendingUnverifiedUser = null;

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);

    if (!credential.user.emailVerified) {
      pendingUnverifiedUser = credential.user;
      await signOut(auth); // 인증 완료된 사용자만 실제 로그인 상태로 전환한다
      loginMessage.textContent = "이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.";
      loginMessage.classList.add("is-error");
      resendVerificationBtn.hidden = false;
      return;
    }

    loginMessage.textContent = "로그인되었습니다.";
    loginForm.reset();
  } catch (error) {
    console.error(error);
    loginMessage.textContent = describeLoginError(error);
    loginMessage.classList.add("is-error");
  }
});

resendVerificationBtn.addEventListener("click", async () => {
  if (!pendingUnverifiedUser) return;

  try {
    await sendEmailVerification(pendingUnverifiedUser);
    loginMessage.textContent = "인증 메일을 다시 보냈습니다. 메일함을 확인해주세요.";
    loginMessage.classList.remove("is-error");
  } catch (error) {
    console.error(error);
    loginMessage.textContent = "인증 메일 재발송에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    loginMessage.classList.add("is-error");
  }
});
