// 로그인 페이지 전용 스크립트. Firebase Authentication(이메일/비밀번호)으로
// 실제 로그인을 수행한다.
import { auth, signInWithEmailAndPassword } from "./firebase-init.js";
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

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  loginMessage.classList.remove("is-error");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginMessage.textContent = "로그인되었습니다.";
    loginForm.reset();
  } catch (error) {
    console.error(error);
    loginMessage.textContent = describeLoginError(error);
    loginMessage.classList.add("is-error");
  }
});
