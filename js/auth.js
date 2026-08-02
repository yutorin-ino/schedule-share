import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export function initAuth({ auth, db, onSignedIn, onSignedOut }) {
  const provider = new GoogleAuthProvider();
  provider.addScope(CALENDAR_SCOPE);
  provider.setCustomParameters({ prompt: "select_account" });

  async function login() {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential.accessToken;
    const { user } = result;

    await setDoc(
      doc(db, "users", user.uid),
      {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        calendarSyncedAt: null
      },
      { merge: true }
    );

    return { user, accessToken };
  }

  function logout() {
    return signOut(auth);
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      onSignedIn(user);
    } else {
      onSignedOut();
    }
  });

  return { login, logout };
}

export function markSynced(db, uid) {
  return setDoc(doc(db, "users", uid), { calendarSyncedAt: serverTimestamp() }, { merge: true });
}
