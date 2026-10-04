import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  connectAuthEmulator,
  Auth,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";

// NEXT_PUBLIC_* values are compiled into the browser bundle. That is expected
// for a Firebase web config: these identify the project, they are not secrets.
// Access control lives in Firebase Auth + firestore.rules.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

const missing = Object.entries({
  NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
})
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0 && !useEmulators) {
  // Names only — never log the values.
  console.error(
    `Firebase is not configured. Missing environment variables: ${missing.join(", ")}. ` +
      "Copy .env.local.example to .env.local and fill them in."
  );
}

const alreadyInitialized = getApps().length > 0;

const app: FirebaseApp = alreadyInitialized
  ? getApp()
  : initializeApp(
      useEmulators
        ? { ...firebaseConfig, apiKey: firebaseConfig.apiKey || "demo-key", projectId: firebaseConfig.projectId || "demo-unifix" }
        : firebaseConfig
    );
// The app only uses email/password sign-in. Initialising Auth without the
// popup/redirect resolver keeps Firebase from injecting a third-party
// script (apis.google.com) that those flows need — which also lets the
// Content-Security-Policy stay strict.
function createAuth(): Auth {
  if (alreadyInitialized) return getAuth(app);
  try {
    return initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
    });
  } catch {
    return getAuth(app); // already initialised elsewhere (e.g. hot reload)
  }
}

const auth: Auth = createAuth();
const db: Firestore = getFirestore(app);

// Local development / automated tests only: talk to the Firebase Emulator
// Suite instead of the real project. Guarded so hot reloads don't reconnect.
if (useEmulators && !alreadyInitialized) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/**
 * Base URL of the Firestore REST API for this project (used for
 * field-projected queries, which the web SDK can't do). Requests carry the
 * signed-in user's ID token, so the same security rules apply.
 */
const firestoreRestBase = `${useEmulators ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com"}/v1/projects/${app.options.projectId}/databases/(default)/documents`;

export { auth, db, firestoreRestBase };
export default app;
