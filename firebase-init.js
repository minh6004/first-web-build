// Firebase 초기화 -- 이 프로젝트의 유일한 Firebase 진입점. 다른 스크립트는
// 여기서 auth/db와 필요한 함수만 가져다 쓴다 (CDN URL/SDK 버전을 한 곳에서만
// 관리하기 위함). 빌드 도구가 없는 순수 정적 사이트라 npm 패키지 대신
// gstatic CDN의 ES 모듈 빌드를 그대로 import한다.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyDOB_oiypB822OiVmllah3jFk7Lpi5Av2c",
  authDomain: "first-web-build.firebaseapp.com",
  projectId: "first-web-build",
  storageBucket: "first-web-build.firebasestorage.app",
  messagingSenderId: "153964524616",
  appId: "1:153964524616:web:9f5ee8f4a1334591a3d47d",
  measurementId: "G-CPL6VQTVL8",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  onAuthStateChanged,
  signOut,
  doc,
  setDoc,
  getDoc,
  writeBatch,
  httpsCallable,
};
