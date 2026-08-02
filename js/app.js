import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collectionGroup,
  collection,
  addDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { FIREBASE_CONFIG } from "./firebase-config.js";
import { initAuth } from "./auth.js";
import { startPeriodicSync } from "./calendar-sync.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userBadge = document.getElementById("user-badge");
const syncStatus = document.getElementById("sync-status");
const addEventForm = document.getElementById("add-event-form");

// Google OAuthアクセストークンはFirebase SDKが自動更新してくれないため、
// メモリ上に保持して同一セッション中の定期同期に使う（約1時間で失効。
// 失効後は再ログインが必要 — 将来的にサーバー側リフレッシュに置き換え可）
let currentAccessToken = null;
let stopSync = null;

// 参加者ごとに色を割り当てるための簡易ハッシュ
const PALETTE = ["#4f46e5", "#059669", "#d97706", "#dc2626", "#0891b2", "#7c3aed", "#db2777", "#65a30d"];
function colorForUid(uid) {
  let hash = 0;
  for (const ch of uid) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const calendarEl = document.getElementById("calendar");
const calendar = new FullCalendar.Calendar(calendarEl, {
  initialView: "timeGridWeek",
  headerToolbar: { left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" },
  height: "auto",
  events: []
});
calendar.render();

const personalEventsByUid = new Map();
let teamEvents = [];

function redraw() {
  const merged = [];
  for (const [uid, events] of personalEventsByUid.entries()) {
    for (const ev of events) {
      merged.push({
        id: `personal-${uid}-${ev.id}`,
        title: ev.ownerName ? `${ev.ownerName}: ${ev.title}` : ev.title,
        start: ev.start,
        end: ev.end,
        allDay: ev.allDay,
        color: colorForUid(uid)
      });
    }
  }
  for (const ev of teamEvents) {
    merged.push({
      id: `team-${ev.id}`,
      title: `📌 ${ev.title}`,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay,
      color: "#111827"
    });
  }
  calendar.removeAllEvents();
  calendar.addEventSource(merged);
}

function subscribeToAllEvents() {
  const userNames = new Map();

  onSnapshot(collection(db, "users"), (snap) => {
    snap.docs.forEach((d) => userNames.set(d.id, d.data().displayName));
  });

  onSnapshot(collectionGroup(db, "events"), (snap) => {
    const grouped = new Map();
    snap.docs.forEach((d) => {
      const uid = d.ref.parent.parent.id;
      const list = grouped.get(uid) || [];
      list.push({ id: d.id, ownerName: userNames.get(uid), ...d.data() });
      grouped.set(uid, list);
    });
    personalEventsByUid.clear();
    for (const [uid, list] of grouped.entries()) personalEventsByUid.set(uid, list);
    redraw();
  });

  onSnapshot(collection(db, "teamEvents"), (snap) => {
    teamEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    redraw();
  });
}

const { login, logout } = initAuth({
  auth,
  db,
  onSignedIn: (user) => {
    loginBtn.hidden = true;
    logoutBtn.hidden = false;
    addEventForm.hidden = false;
    userBadge.textContent = `${user.displayName} (${user.email})`;
  },
  onSignedOut: () => {
    loginBtn.hidden = false;
    logoutBtn.hidden = true;
    addEventForm.hidden = true;
    userBadge.textContent = "";
    syncStatus.textContent = "";
    if (stopSync) stopSync();
  }
});

loginBtn.addEventListener("click", async () => {
  try {
    const { user, accessToken } = await login();
    currentAccessToken = accessToken;
    stopSync = startPeriodicSync({
      db,
      uid: user.uid,
      getAccessToken: async () => currentAccessToken
    });
    syncStatus.textContent = "Googleカレンダーを同期しています…";
  } catch (err) {
    console.error(err);
    syncStatus.textContent = "ログインに失敗しました。コンソールを確認してください。";
  }
});

logoutBtn.addEventListener("click", () => logout());

addEventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(addEventForm);
  const title = formData.get("title");
  const start = formData.get("start");
  const end = formData.get("end");
  if (!title || !start || !end) return;

  await addDoc(collection(db, "teamEvents"), {
    title,
    start,
    end,
    allDay: false,
    createdBy: auth.currentUser.uid
  });
  addEventForm.reset();
});

subscribeToAllEvents();
