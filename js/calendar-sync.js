import {
  collection,
  doc,
  writeBatch,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { SYNC_CONFIG } from "./firebase-config.js";
import { markSynced } from "./auth.js";

function toIso(date) {
  return date.toISOString();
}

async function fetchGoogleEvents(accessToken) {
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - SYNC_CONFIG.daysBefore);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + SYNC_CONFIG.daysAfter);

  const params = new URLSearchParams({
    timeMin: toIso(timeMin),
    timeMax: toIso(timeMax),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250"
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Google Calendar API error: ${res.status}`);
  }

  const data = await res.json();
  return data.items || [];
}

function normalizeEvent(googleEvent) {
  const start = googleEvent.start.dateTime || googleEvent.start.date;
  const end = googleEvent.end.dateTime || googleEvent.end.date;
  const allDay = !googleEvent.start.dateTime;

  return {
    id: googleEvent.id,
    title: googleEvent.summary || "(タイトルなし)",
    start,
    end,
    allDay,
    source: "google"
  };
}

export async function syncGoogleCalendar({ db, uid, accessToken }) {
  const googleEvents = await fetchGoogleEvents(accessToken);
  const eventsRef = collection(db, "users", uid, "events");

  const existingSnap = await getDocs(eventsRef);
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));
  const incomingIds = new Set(googleEvents.map((e) => e.id));

  const batch = writeBatch(db);

  for (const googleEvent of googleEvents) {
    const normalized = normalizeEvent(googleEvent);
    batch.set(doc(eventsRef, normalized.id), normalized);
  }

  for (const existingId of existingIds) {
    if (!incomingIds.has(existingId)) {
      batch.delete(doc(eventsRef, existingId));
    }
  }

  await batch.commit();
  await markSynced(db, uid);
}

export function startPeriodicSync({ db, uid, getAccessToken }) {
  const run = async () => {
    try {
      const accessToken = await getAccessToken();
      if (accessToken) {
        await syncGoogleCalendar({ db, uid, accessToken });
      }
    } catch (err) {
      console.error("カレンダー同期に失敗しました", err);
    }
  };

  run();
  const intervalId = setInterval(run, SYNC_CONFIG.intervalMs);
  return () => clearInterval(intervalId);
}
