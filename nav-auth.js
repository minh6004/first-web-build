// 상단 네비게이션의 '로그인' 항목을 실제 로그인 상태에 맞춰 갱신한다.
// 모든 페이지(index/issue-briefing/login/signup)의 헤더가 동일한
// <a id="navAuthLink"> 구조를 쓰므로, 이 한 함수를 각 페이지 스크립트에서
// 불러다 쓰면 된다.
import { auth, db, onAuthStateChanged, signOut, doc, getDoc } from "./firebase-init.js";

export function initNavAuth() {
  const navAuthLink = document.getElementById("navAuthLink");
  if (!navAuthLink) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      navAuthLink.textContent = "로그인";
      navAuthLink.href = "login.html";
      navAuthLink.removeAttribute("title");
      navAuthLink.onclick = null;
      return;
    }

    let displayName = user.email;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists() && snap.data().name) {
        displayName = snap.data().name;
      }
    } catch (error) {
      console.error("프로필 조회 실패:", error);
    }

    navAuthLink.textContent = displayName;
    navAuthLink.href = "#";
    navAuthLink.title = "로그아웃";
    navAuthLink.removeAttribute("aria-current"); // login.html이 이 링크를 "현재 페이지"로 표시해뒀을 수 있는데, 이제 로그아웃 버튼 역할이라 더 이상 맞지 않음
    navAuthLink.onclick = (event) => {
      event.preventDefault();
      signOut(auth);
    };
  });
}
