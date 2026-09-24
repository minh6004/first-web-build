// 회원가입 2단계의 전화번호 SMS 인증(OTP) 전용 Cloud Functions.
//
// 왜 여기(서버)에 있어야 하는가: Solapi API 키/시크릿은 SMS를 실제로
// 발송하고 계정에 비용을 청구할 수 있는 진짜 비밀값이다. 정적 사이트의
// 클라이언트 JS(signup-info.js)에 넣으면 누구나 페이지 소스/네트워크
// 탭에서 그대로 훔쳐갈 수 있으므로, 절대 프론트엔드 코드에 두면 안 된다.
// Firebase Cloud Functions(서버)에서만 Secret Manager로 안전하게 보관하고
// 호출한다.
//
// 인증번호는 Firestore(phoneOtps/{전화번호})에 만료시각과 함께 저장하고,
// 검증에 성공하는 즉시 삭제한다(스펙 요구사항 "검증 후 즉시 폐기").
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { SolapiMessageService } = require("solapi");

admin.initializeApp();
const db = admin.firestore();

const solapiApiKey = defineSecret("SOLAPI_API_KEY");
const solapiApiSecret = defineSecret("SOLAPI_API_SECRET");
const solapiSenderPhone = defineSecret("SOLAPI_SENDER_PHONE"); // Solapi 계정에 등록·인증된 발신번호여야 함

const OTP_TTL_MS = 3 * 60 * 1000; // 3분

// ponytail: 같은 번호로 60초에 한 번만 재요청 가능하게 하는 최소한의 남용
// 방지. IP 기반 제한이나 캡차는 아니라서(전화번호만 다르면 계속 요청 가능),
// 실제로 남용/스팸 우려가 생기면 App Check나 IP 레이트리밋으로 강화할 것.
const REQUEST_COOLDOWN_MS = 60 * 1000;

function normalizePhone(raw) {
  return String(raw || "").replace(/\D/g, "");
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.requestPhoneOtp = onCall({ secrets: [solapiApiKey, solapiApiSecret, solapiSenderPhone] }, async (request) => {
  const phone = normalizePhone(request.data?.phone);
  if (!/^01[016789]\d{7,8}$/.test(phone)) {
    throw new HttpsError("invalid-argument", "전화번호 형식이 올바르지 않습니다.");
  }

  const docRef = db.collection("phoneOtps").doc(phone);
  const existing = await docRef.get();
  const now = Date.now();
  if (existing.exists && now - (existing.data().lastRequestedAt || 0) < REQUEST_COOLDOWN_MS) {
    throw new HttpsError("resource-exhausted", "잠시 후 다시 시도해주세요.");
  }

  const code = generateOtp();
  const expiresAt = now + OTP_TTL_MS;
  await docRef.set({ code, expiresAt, lastRequestedAt: now });

  const messageService = new SolapiMessageService(solapiApiKey.value(), solapiApiSecret.value());
  try {
    await messageService.send({
      to: phone,
      from: solapiSenderPhone.value(),
      text: `[StockLens] 인증번호는 ${code}입니다. 3분 이내에 입력해주세요.`,
    });
  } catch (error) {
    console.error("Solapi 발송 실패:", error);
    await docRef.delete(); // 발송이 실패했으면 저장해둔 코드도 의미가 없으니 같이 지운다
    throw new HttpsError("internal", "인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.");
  }

  return { success: true, expiresInMs: OTP_TTL_MS };
});

exports.verifyPhoneOtp = onCall(async (request) => {
  const phone = normalizePhone(request.data?.phone);
  const inputCode = String(request.data?.code || "").trim();

  const docRef = db.collection("phoneOtps").doc(phone);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "인증번호를 먼저 요청해주세요.");
  }

  const { code, expiresAt } = snap.data();
  if (Date.now() > expiresAt) {
    await docRef.delete();
    throw new HttpsError("deadline-exceeded", "인증번호 유효시간이 만료되었습니다. 다시 요청해주세요.");
  }
  if (inputCode !== code) {
    throw new HttpsError("permission-denied", "인증번호가 일치하지 않습니다.");
  }

  await docRef.delete(); // 검증 성공 시 즉시 폐기(스펙 요구사항)
  return { success: true };
});
