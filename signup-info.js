// 회원가입 2단계(정보 입력) 페이지 전용 스크립트. Firebase Authentication
// (이메일/비밀번호)으로 계정을 만들고, Firestore의 users/{uid} 문서에
// 나머지 프로필(이름/전화번호/아이디/주소)을 저장한다. 로그인은 여전히
// 이메일 기준이라(login.js 변경 없음), 여기서 받는 "아이디"는 인증 자격이
// 아니라 프로필에 딸린 별도 필드다 -- 중복만 막으면 되므로
// usernames/{username} 예약 문서로 유일성을 보장한다.
import { auth, db, createUserWithEmailAndPassword, sendEmailVerification, signOut, doc, getDoc, writeBatch } from "./firebase-init.js";
import { initNavAuth } from "./nav-auth.js";

// ---------------------------------------------------------------------------
// 1단계를 거치지 않고 이 페이지로 바로 들어온 경우 되돌려보낸다. 스크립트
// 최상단에서(다른 어떤 UI 초기화보다 먼저) 확인해서, 리다이렉트될 페이지가
// 잠깐이라도 그려지지 않게 한다. sessionStorage는 클라이언트에만 있는
// 값이라 개발자도구로 직접 조작하면 우회는 가능하다 -- 이건 서버 세션이
// 아닌 정적 사이트에서 "실수로 URL을 북마크해 1단계를 건너뛰는" 일반적인
// 경우를 막기 위한 장치이지, 완전한 접근 제어가 아니다.
if (sessionStorage.getItem("signupTermsAgreed") !== "true") {
  window.location.replace("signup.html");
  throw new Error("1단계(약관 동의)를 거치지 않아 signup.html로 되돌립니다.");
}

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// ---------------------------------------------------------------------------
// 필드 요소
// ---------------------------------------------------------------------------
const form = document.getElementById("signupInfoForm");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const passwordConfirmInput = document.getElementById("passwordConfirm");
const emailInput = document.getElementById("email");
const zonecodeInput = document.getElementById("zonecode");
const addressInput = document.getElementById("address");
const addressDetailInput = document.getElementById("addressDetail");
const addressSearchBtn = document.getElementById("addressSearchBtn");
const submitBtn = document.getElementById("signupSubmit");
const signupMessage = document.getElementById("signupMessage");

// ---------------------------------------------------------------------------
// 전화번호: 숫자만 남기고 자동으로 하이픈을 붙인다(010-1234-5678 형태).
// ---------------------------------------------------------------------------
function formatPhone(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

phoneInput.addEventListener("input", () => {
  phoneInput.value = formatPhone(phoneInput.value);
});

// ---------------------------------------------------------------------------
// 개별 필드 검증 규칙. 전부 "값이 비었으면 필수 메시지, 형식이 틀리면 형식
// 메시지, 맞으면 null"을 반환하는 함수로 통일해서 제출 시 한 번에 훑는다.
// ---------------------------------------------------------------------------
const NAME_PATTERN = /^[가-힣a-zA-Z\s]{1,30}$/;
const PHONE_PATTERN = /^01[016789]-\d{3,4}-\d{4}$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9]{4,20}$/;
const GMAIL_PATTERN = /^[^\s@]+@gmail\.com$/i;

function validateName() {
  const value = nameInput.value.trim();
  if (!value) return "이름을 입력해주세요.";
  if (!NAME_PATTERN.test(value)) return "이름은 한글 또는 영문만 입력할 수 있습니다.";
  return null;
}

function validatePhone() {
  const value = phoneInput.value.trim();
  if (!value) return "전화번호를 입력해주세요.";
  if (!PHONE_PATTERN.test(value)) return "휴대폰 번호 형식이 올바르지 않습니다. (예: 010-1234-5678)";
  return null;
}

function validateUsernameFormat() {
  const value = usernameInput.value.trim();
  if (!value) return "아이디를 입력해주세요.";
  if (!USERNAME_PATTERN.test(value)) return "아이디는 영문/숫자 조합 4~20자로 입력해주세요.";
  return null;
}

// 8자 이상 + 영문/숫자/특수문자 중 2종류 이상
function isPasswordStrongEnough(value) {
  if (value.length < 8) return false;
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasDigit = /[0-9]/.test(value);
  const hasSpecial = /[^a-zA-Z0-9]/.test(value);
  return [hasLetter, hasDigit, hasSpecial].filter(Boolean).length >= 2;
}

function validatePassword() {
  const value = passwordInput.value;
  if (!value) return "비밀번호를 입력해주세요.";
  if (!isPasswordStrongEnough(value)) return "비밀번호는 8자 이상, 영문·숫자·특수문자 중 2종류 이상을 조합해야 합니다.";
  return null;
}

function validatePasswordConfirm() {
  if (!passwordConfirmInput.value) return "비밀번호를 한 번 더 입력해주세요.";
  if (passwordConfirmInput.value !== passwordInput.value) return "비밀번호가 일치하지 않습니다.";
  return null;
}

function validateEmail() {
  const value = emailInput.value.trim();
  if (!value) return "이메일 주소를 입력해주세요.";
  if (!GMAIL_PATTERN.test(value)) return "Gmail 주소만 가입 가능합니다.";
  return null;
}

function validateAddress() {
  if (!zonecodeInput.value || !addressInput.value) return "주소 검색을 통해 주소를 입력해주세요.";
  if (!addressDetailInput.value.trim()) return "상세주소를 입력해주세요.";
  return null;
}

// 비밀번호 확인은 두 입력 필드 중 하나라도 바뀔 때마다 즉시 확인해준다.
function refreshPasswordConfirmHint() {
  const hint = document.getElementById("passwordConfirmHint");
  if (!passwordConfirmInput.value) {
    hint.textContent = "";
    return;
  }
  hint.textContent = passwordConfirmInput.value === passwordInput.value ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다.";
}

passwordInput.addEventListener("input", refreshPasswordConfirmHint);
passwordConfirmInput.addEventListener("input", refreshPasswordConfirmHint);

// ---------------------------------------------------------------------------
// 아이디 중복 확인(실시간, 입력을 멈추고 500ms 뒤에 조회). 최종 확정은 항상
// 제출 시점에 서버(Firestore)에서 다시 한번 확인한다 -- 이 실시간 체크는
// 사용자 경험을 위한 사전 안내일 뿐, 그 사이 다른 사람이 같은 아이디를
// 먼저 가져갈 수 있는 경합은 여전히 남아있다(제출 시 배치 쓰기가 최종
// 방어선).
const usernameHint = document.getElementById("usernameHint");
let usernameCheckToken = 0;

async function checkUsernameAvailability() {
  const formatError = validateUsernameFormat();
  if (formatError) {
    usernameHint.textContent = formatError;
    usernameInput.dataset.available = "";
    return;
  }

  const myToken = ++usernameCheckToken;
  usernameHint.textContent = "확인 중...";
  try {
    const snap = await getDoc(doc(db, "usernames", usernameInput.value.trim()));
    if (myToken !== usernameCheckToken) return; // 그 사이 사용자가 또 입력을 바꿨으면 이 결과는 버린다
    if (snap.exists()) {
      usernameHint.textContent = "이미 사용 중인 아이디입니다.";
      usernameInput.dataset.available = "";
    } else {
      usernameHint.textContent = "사용 가능한 아이디입니다.";
      usernameInput.dataset.available = "true";
    }
  } catch (error) {
    if (myToken !== usernameCheckToken) return;
    console.error("아이디 중복 확인 실패:", error);
    usernameHint.textContent = "아이디 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    usernameInput.dataset.available = "";
  }
}

let usernameDebounceTimer = null;
usernameInput.addEventListener("input", () => {
  usernameInput.dataset.available = "";
  clearTimeout(usernameDebounceTimer);
  usernameDebounceTimer = setTimeout(checkUsernameAvailability, 500);
});

// ---------------------------------------------------------------------------
// 다음(카카오) 우편번호 서비스. postcode.v2.js는 <script> 태그로 이미
// signup-info.html에서 불러왔다(전역 daum.Postcode).
// ---------------------------------------------------------------------------
addressSearchBtn.addEventListener("click", () => {
  new daum.Postcode({
    oncomplete(data) {
      zonecodeInput.value = data.zonecode;
      addressInput.value = data.roadAddress || data.jibunAddress;
      addressDetailInput.focus();
    },
  }).open();
});

// ---------------------------------------------------------------------------
// 제출
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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  signupMessage.textContent = "";
  signupMessage.classList.remove("is-error");

  // 필수 항목 누락/형식 오류를 한 번에 모아서, 첫 번째 문제를 사용자가 알기
  // 쉬운 문구로 보여준다.
  const errors = [validateName(), validatePhone(), validateUsernameFormat(), validatePassword(), validatePasswordConfirm(), validateEmail(), validateAddress()];
  const firstError = errors.find((e) => e !== null);
  if (firstError) {
    signupMessage.textContent = firstError;
    signupMessage.classList.add("is-error");
    return;
  }

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  const email = emailInput.value.trim();
  const zonecode = zonecodeInput.value;
  const address = addressInput.value;
  const addressDetail = addressDetailInput.value.trim();

  submitBtn.disabled = true;

  try {
    // 제출 시점에 아이디를 다시 한번 확인한다(실시간 체크 이후 다른 사람이
    // 먼저 가져갔을 수 있으므로) -- 이 확인과 그 아래 계정 생성 사이에도
    // 아주 짧은 경합 창이 남아있지만, Firestore 쓰기 자체는 예약 문서가
    // 이미 있으면 규칙상 덮어쓸 수 없어 최종적으로는 안전하다.
    const existing = await getDoc(doc(db, "usernames", username));
    if (existing.exists()) {
      signupMessage.textContent = "이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.";
      signupMessage.classList.add("is-error");
      submitBtn.disabled = false;
      return;
    }

    // 비밀번호는 여기서 평문 그대로 Firebase Authentication에 넘긴다 --
    // Firebase Auth가 서버 측에서 scrypt로 해싱해서 저장하고, 우리 코드나
    // Firestore 어디에도 평문/해시가 남지 않는다. Firestore에는 프로필
    // 정보만 저장한다(비밀번호 필드 없음).
    const credential = await createUserWithEmailAndPassword(auth, email, password);

    const batch = writeBatch(db);
    batch.set(doc(db, "users", credential.user.uid), {
      name,
      phone,
      username,
      address: { zonecode, address, addressDetail },
    });
    batch.set(doc(db, "usernames", username), {}); // 존재 여부만 의미 있는 예약 문서
    await batch.commit();

    await sendEmailVerification(credential.user);
    await signOut(auth); // 인증 완료 전까지는 로그인 상태로 취급하지 않는다
    sessionStorage.removeItem("signupTermsAgreed");

    signupMessage.classList.remove("is-error");
    signupMessage.textContent = "입력하신 Gmail로 인증 메일을 보냈습니다. 메일함에서 링크를 클릭해 인증을 완료해주세요.";
    form.reset();
  } catch (error) {
    console.error(error);
    signupMessage.textContent = describeSignupError(error);
    signupMessage.classList.add("is-error");
  } finally {
    submitBtn.disabled = false;
  }
});
