// Firebase初期化・認証
// CDN版Firebase SDKを使用（index.htmlからimportmap経由で読み込み）

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut as fbSignOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Firebase設定（kaji-appと同じプロジェクト）
const firebaseConfig = {
  apiKey: "AIzaSyA4BUaolJgtd6ocxdrsVIFAAphJl53lAMw",
  authDomain: "kaji-app-dbd61.firebaseapp.com",
  projectId: "kaji-app-dbd61",
  storageBucket: "kaji-app-dbd61.firebasestorage.app",
  messagingSenderId: "418084439735",
  appId: "1:418084439735:web:2aa9f697a54e99f2f22f32"
};

let app;
let auth;
let db;

export function initAuth() {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

export function getDb() {
  return db;
}

export function onAuthChange(callback) {
  onAuthStateChanged(auth, callback);
}

export async function signIn() {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      alert('ログインに失敗しました: ' + err.message);
    }
  }
}

export async function signOut() {
  await fbSignOut(auth);
}
