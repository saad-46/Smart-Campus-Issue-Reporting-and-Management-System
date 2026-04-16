// ============================================
// Firebase App Initialization
// ============================================
// Initializes Firebase with environment variables.
// Uses getApps() to prevent duplicate initialization.

import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// List of placeholder values that indicate config is not set up
const PLACEHOLDER_VALUES = [
  "your_api_key_here",
  "your_project.firebaseapp.com",
  "your_project_id",
  "your_project.appspot.com",
  "your_sender_id",
  "your_app_id",
  "AIzaSyDemoKey123456789-REPLACE_WITH_YOUR_KEY",
  "campus-iq-demo.firebaseapp.com",
  "campus-iq-demo",
  "campus-iq-demo.appspot.com",
];

// Validate Firebase configuration
function validateFirebaseConfig(): boolean {
  const requiredFields = [
    { key: "apiKey", value: firebaseConfig.apiKey },
    { key: "authDomain", value: firebaseConfig.authDomain },
    { key: "projectId", value: firebaseConfig.projectId },
    { key: "storageBucket", value: firebaseConfig.storageBucket },
    { key: "messagingSenderId", value: firebaseConfig.messagingSenderId },
    { key: "appId", value: firebaseConfig.appId },
  ];

  let isValid = true;
  const missingFields: string[] = [];
  const placeholderFields: string[] = [];

  for (const field of requiredFields) {
    if (!field.value) {
      missingFields.push(field.key);
      isValid = false;
    } else if (PLACEHOLDER_VALUES.includes(field.value)) {
      placeholderFields.push(field.key);
      isValid = false;
    }
  }

  if (!isValid) {
    console.error("\n" + "=".repeat(60));
    console.error("❌ FIREBASE CONFIGURATION ERROR");
    console.error("=".repeat(60));

    if (missingFields.length > 0) {
      console.error("\n🚫 Missing environment variables:");
      missingFields.forEach((field) => {
        console.error(`   - NEXT_PUBLIC_FIREBASE_${field.toUpperCase()}`);
      });
    }

    if (placeholderFields.length > 0) {
      console.error("\n⚠️  Using placeholder values for:");
      placeholderFields.forEach((field) => {
        console.error(`   - ${field}: ${(firebaseConfig as any)[field]}`);
      });
    }

    console.error("\n📋 TO FIX THIS:");
    console.error("   1. Go to https://console.firebase.google.com");
    console.error("   2. Create a new project (or select existing)");
    console.error("   3. Click ⚙️ > Project settings");
    console.error("   4. Scroll to 'Your apps' > Add web app (</> icon)");
    console.error("   5. Copy the config values");
    console.error("   6. Update .env.local with your real values");
    console.error("   7. Restart dev server: npm run dev");
    console.error("\n" + "=".repeat(60) + "\n");
  }

  return isValid;
}

// Validate config
const isConfigValid = validateFirebaseConfig();

if (isConfigValid) {
  console.log("✅ Firebase configuration loaded successfully");
  console.log("📦 Project ID:", firebaseConfig.projectId);
}

import { getStorage, FirebaseStorage } from "firebase/storage";

// Initialize Firebase app
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

try {
  // Initialize Firebase only once
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (isConfigValid) {
    console.log("🔥 Firebase initialized successfully");
  }
} catch (error) {
  console.error("❌ Failed to initialize Firebase:", error);
  throw new Error("Firebase initialization failed. Check your configuration.");
}

export { auth, db, storage };
export default app;
