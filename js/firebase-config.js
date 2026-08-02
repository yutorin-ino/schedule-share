// Firebase Console > プロジェクトの設定 > 全般 > マイアプリ で発行される
// 設定オブジェクトをそのまま貼り付けてください。
// (apiKey はクライアント公開前提の値なので、Gitに含めても問題ありません)
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// カレンダー同期の対象期間・間隔
export const SYNC_CONFIG = {
  daysBefore: 7,
  daysAfter: 30,
  intervalMs: 5 * 60 * 1000 // 5分
};
