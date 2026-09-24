// 회원가입 2단계(정보 입력) 페이지 전용 스크립트. 여기서는 계정을 만들지
// 않는다 -- 입력값을 검증만 하고 sessionStorage(signupFormData)에 저장해둔
// 뒤 3단계(signup-verify.html)로 넘긴다. 실제 Firebase Authentication 계정
// 생성/Firestore 저장/전화번호 SMS 인증은 전부 3단계에서 처리한다(전화번호
// 본인 확인이 끝나야 가입이 완료되는 흐름이라, 계정 생성을 그 뒤로 미뤘다).
//
// "아이디"(username)는 로그인에 쓰는 값이 아니다(로그인은 여전히 이메일
// 기준) -- 별도 프로필 필드이며, 중복 방지를 위해 usernames/{username}
// 예약 문서로 유일성을 보장한다(실제 예약은 3단계에서 계정을 만들 때).
import { db, doc, getDoc } from "./firebase-init.js";
import { initNavAuth } from "./nav-auth.js";

// ---------------------------------------------------------------------------
// 1단계를 거치지 않고 이 페이지로 바로 들어온 경우 되돌려보낸다.
// ---------------------------------------------------------------------------
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
const nextStepBtn = document.getElementById("nextStepBtn");
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
// 3단계에서 계정을 실제로 만들기 직전에 서버(Firestore)에서 다시 한번
// 확인한다 -- 이 실시간 체크는 사용자 경험을 위한 사전 안내일 뿐이다.
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
// 제출("다음") -- 계정을 만들지 않고, 검증된 값을 sessionStorage에 저장한
// 뒤 3단계로 이동한다.
// ---------------------------------------------------------------------------
form.addEventListener("submit", (event) => {
  event.preventDefault();
  signupMessage.textContent = "";
  signupMessage.classList.remove("is-error");

  const errors = [validateName(), validatePhone(), validateUsernameFormat(), validatePassword(), validatePasswordConfirm(), validateEmail(), validateAddress()];
  const firstError = errors.find((e) => e !== null);
  if (firstError) {
    signupMessage.textContent = firstError;
    signupMessage.classList.add("is-error");
    return;
  }

  const formData = {
    name: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    username: usernameInput.value.trim(),
    password: passwordInput.value,
    email: emailInput.value.trim(),
    zonecode: zonecodeInput.value,
    address: addressInput.value,
    addressDetail: addressDetailInput.value.trim(),
  };

  // sessionStorage는 이 브라우저 탭에만 저장되고 네트워크로 전송되지
  // 않는다 -- 서버 세션 없이 여러 페이지에 걸쳐 입력값을 넘기기 위한
  // 것으로, 지금까지 이 플로우가 써온 것과 같은 신뢰 경계다.
  //
  // 뒤로가기로 여기 다시 와서 전화번호 등을 바꾸고 "다음"을 다시 누르는
  // 경우도 이 한 줄로 자연스럽게 처리된다: 3단계(signup-verify.js)의
  // 인증 진행 상태는 sessionStorage가 아니라 그 페이지 자바스크립트의
  // 메모리에만 있다가 페이지를 벗어나면 사라지므로, 새로 저장된
  // signupFormData로 3단계를 다시 열면 인증은 항상 처음부터 다시
  // 시작한다(이전에 인증받았던 상태가 남아있을 수 없음).
  sessionStorage.setItem("signupFormData", JSON.stringify(formData));

  window.location.href = "signup-verify.html";
});
