// 회원가입 3단계(본인인증) 페이지 전용 스크립트. 2단계가 sessionStorage에
// 남겨둔 signupFormData의 전화번호로 SMS 인증을 진행하고, 인증에 성공하는
// 순간 실제로 Firebase Authentication 계정을 만들고 Firestore에 프로필을
// 저장한다 -- "전화번호 인증이 필수 절차"라는 스펙 요구사항대로, 인증되지
// 않으면 계정 자체가 생기지 않는다.
//
// 실제 SMS 발송/검증은 Cloud Functions(functions/index.js의
// requestPhoneOtp/verifyPhoneOtp)가 서버 측에서 처리한다 -- Solapi API
// 키는 절대 이 프론트엔드 코드에 두면 안 되는 진짜 비밀값이라, 정적
// 사이트에서 직접 호출할 수 없다.
import { auth, db, functions, createUserWithEmailAndPassword, sendEmailVerification, signOut, doc, getDoc, writeBatch, httpsCallable } from "./firebase-init.js";
import { initNavAuth } from "./nav-auth.js";

// ---------------------------------------------------------------------------
// 접근 제어: 1단계를 안 거쳤으면 1단계로, 1단계는 거쳤지만 2단계 데이터가
// 없으면(=2단계를 안 거치고 URL로 바로 들어옴) 2단계로 되돌려보낸다.
// ---------------------------------------------------------------------------
if (sessionStorage.getItem("signupTermsAgreed") !== "true") {
  window.location.replace("signup.html");
  throw new Error("1단계(약관 동의)를 거치지 않아 signup.html로 되돌립니다.");
}

let formData;
try {
  formData = JSON.parse(sessionStorage.getItem("signupFormData") || "null");
} catch {
  formData = null;
}
if (!formData || !formData.phone) {
  window.location.replace("signup-info.html");
  throw new Error("2단계(정보 입력)를 거치지 않아 signup-info.html로 되돌립니다.");
}

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// ---------------------------------------------------------------------------
// 전화번호 마스킹: "010-1234-5678" -> "010-****-5678"(가운데 그룹만 가림).
// ---------------------------------------------------------------------------
function maskPhone(phone) {
  const parts = phone.split("-");
  if (parts.length !== 3) return phone;
  return `${parts[0]}-****-${parts[2]}`;
}

document.getElementById("maskedPhone").textContent = maskPhone(formData.phone);

// ---------------------------------------------------------------------------
// 요소
// ---------------------------------------------------------------------------
const requestOtpBtn = document.getElementById("requestOtpBtn");
const otpRow = document.getElementById("otpRow");
const otpCodeInput = document.getElementById("otpCode");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const otpTimer = document.getElementById("otpTimer");
const otpHint = document.getElementById("otpHint");
const nextStepBtn = document.getElementById("nextStepBtn");
const verifyMessage = document.getElementById("verifyMessage");

// ---------------------------------------------------------------------------
// OTP 요청/검증
// ---------------------------------------------------------------------------
const requestPhoneOtpCallable = httpsCallable(functions, "requestPhoneOtp");
const verifyPhoneOtpCallable = httpsCallable(functions, "verifyPhoneOtp");

const OTP_DURATION_MS = 3 * 60 * 1000; // Cloud Functions 쪽 만료시간과 맞춤(3분)
let countdownTimerId = null;
let countdownEndsAt = null;
let hasSentOnce = false;

// Cloud Functions가 직접 만들어 던진 에러(functions/index.js의 HttpsError)만
// 그 메시지를 그대로 보여준다 -- "functions/internal" 같은 SDK 자체
// 일반 에러 코드(배포 안 됨/네트워크 문제 등)는 사용자에게 의미 없는
// 문자열이라 항상 우리가 정한 안내 문구로 대체한다.
const OTP_KNOWN_ERROR_CODES = ["functions/invalid-argument", "functions/resource-exhausted", "functions/deadline-exceeded", "functions/permission-denied", "functions/not-found"];

function describeOtpError(error, fallback) {
  return OTP_KNOWN_ERROR_CODES.includes(error.code) && error.message ? error.message : fallback;
}

function stopCountdown() {
  clearInterval(countdownTimerId);
  countdownTimerId = null;
  otpTimer.textContent = "";
}

function startCountdown(durationMs) {
  countdownEndsAt = Date.now() + durationMs;
  const tick = () => {
    const remainingMs = countdownEndsAt - Date.now();
    if (remainingMs <= 0) {
      stopCountdown();
      otpHint.textContent = "인증번호 유효시간이 만료되었습니다. 재전송 버튼을 눌러주세요.";
      requestOtpBtn.disabled = false;
      verifyOtpBtn.disabled = true;
      return;
    }
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    otpTimer.textContent = `${mm}:${ss}`;
  };
  tick();
  countdownTimerId = setInterval(tick, 1000);
}

requestOtpBtn.addEventListener("click", async () => {
  requestOtpBtn.disabled = true;
  otpHint.textContent = "";
  try {
    const result = await requestPhoneOtpCallable({ phone: formData.phone });
    hasSentOnce = true;
    requestOtpBtn.textContent = "재전송";
    otpRow.hidden = false;
    otpCodeInput.value = "";
    verifyOtpBtn.disabled = false;
    otpCodeInput.focus();
    otpHint.textContent = "인증번호를 보냈습니다. 3분 안에 입력해주세요.";
    startCountdown(result.data.expiresInMs || OTP_DURATION_MS);
  } catch (error) {
    console.error("인증번호 요청 실패:", error);
    otpHint.textContent = describeOtpError(error, "인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
    requestOtpBtn.disabled = false;
    requestOtpBtn.textContent = hasSentOnce ? "재전송" : "인증번호 받기";
  }
});

verifyOtpBtn.addEventListener("click", async () => {
  const code = otpCodeInput.value.trim();
  if (!code) {
    otpHint.textContent = "인증번호를 입력해주세요.";
    return;
  }

  verifyOtpBtn.disabled = true;
  requestOtpBtn.disabled = true;
  otpHint.textContent = "확인 중...";
  try {
    await verifyPhoneOtpCallable({ phone: formData.phone, code });
    stopCountdown();
    otpHint.textContent = "휴대폰 인증이 완료되었습니다. 가입 정보를 저장하는 중...";
    await completeSignup();
  } catch (error) {
    console.error("인증번호 확인 실패:", error);
    otpHint.textContent = describeOtpError(error, "인증번호 확인 중 오류가 발생했습니다.");
    verifyOtpBtn.disabled = false;
    requestOtpBtn.disabled = countdownTimerId !== null; // 카운트다운이 아직 살아있으면 재전송도 계속 막아둔다
  }
});

// ---------------------------------------------------------------------------
// 실제 계정 생성 -- 전화번호 인증에 성공한 직후에만 호출된다. 2단계에서
// 이미 형식 검증을 마친 값들을 그대로 쓰되, 아이디 중복만 한 번 더
// 확인한다(그 사이 다른 사람이 먼저 가져갔을 수 있으므로).
// ---------------------------------------------------------------------------
const SIGNUP_ERROR_MESSAGES = {
  "auth/email-already-in-use": "이미 가입된 이메일입니다.",
  "auth/invalid-email": "이메일 형식이 올바르지 않습니다.",
  "auth/weak-password": "비밀번호는 6자 이상이어야 합니다.",
  "auth/network-request-failed": "네트워크 상태를 확인해 주세요.",
};

function describeSignupError(error) {
  return SIGNUP_ERROR_MESSAGES[error.code] || "가입 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

async function completeSignup() {
  verifyMessage.textContent = "";
  verifyMessage.classList.remove("is-error");

  try {
    const existing = await getDoc(doc(db, "usernames", formData.username));
    if (existing.exists()) {
      verifyMessage.textContent = "이미 사용 중인 아이디입니다. 이전 단계로 돌아가 다른 아이디를 입력해주세요.";
      verifyMessage.classList.add("is-error");
      return;
    }

    // 비밀번호는 여기서 평문 그대로 Firebase Authentication에 넘긴다 --
    // Firebase Auth가 서버 측에서 scrypt로 해싱해서 저장하고, 우리 코드나
    // Firestore 어디에도 평문/해시가 남지 않는다. Firestore에는 프로필
    // 정보만 저장한다(비밀번호 필드 없음).
    const credential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

    const batch = writeBatch(db);
    batch.set(doc(db, "users", credential.user.uid), {
      name: formData.name,
      phone: formData.phone,
      username: formData.username,
      address: { zonecode: formData.zonecode, address: formData.address, addressDetail: formData.addressDetail },
    });
    batch.set(doc(db, "usernames", formData.username), {}); // 존재 여부만 의미 있는 예약 문서
    await batch.commit();

    await sendEmailVerification(credential.user);
    await signOut(auth); // 인증 완료 전까지는 로그인 상태로 취급하지 않는다

    // 비밀번호 등 민감한 값이 담긴 폼 데이터는 더 이상 필요 없으니 지운다.
    sessionStorage.removeItem("signupFormData");
    sessionStorage.setItem("signupCompleted", "true");

    otpHint.textContent = "휴대폰 인증이 완료되었습니다.";
    nextStepBtn.disabled = false;
  } catch (error) {
    console.error(error);
    verifyMessage.textContent = describeSignupError(error);
    verifyMessage.classList.add("is-error");
    verifyOtpBtn.disabled = false;
  }
}

nextStepBtn.addEventListener("click", () => {
  window.location.href = "signup-complete.html";
});
