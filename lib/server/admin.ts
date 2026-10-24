// Firebase Admin SDK (server only). Never import this from browser code.
//
// Production: FIREBASE_SERVICE_ACCOUNT_JSON holds the service-account key as
// one JSON string (a Vercel "sensitive" environment variable).
// Local emulators: FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST are
// set, and no credential is needed.

import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export class AdminNotConfigured extends Error {
  constructor() {
    super("Server credentials are not configured.");
    this.name = "AdminNotConfigured";
  }
}

export const usingEmulators = () => !!process.env.FIREBASE_AUTH_EMULATOR_HOST && !!process.env.FIRESTORE_EMULATOR_HOST;

function app(): App {
  const existing = getApps()[0];
  if (existing) return existing;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (usingEmulators()) return initializeApp({ projectId: projectId || "demo-unifix" });
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new AdminNotConfigured();
  try {
    const account = JSON.parse(json);
    // The server key and the browser config must belong to the same project, so a
    // Preview build can never mix test and production Firebase projects.
    if (!projectId || account.project_id !== projectId) throw new AdminNotConfigured();
    return initializeApp({ credential: cert(account), projectId });
  } catch {
    throw new AdminNotConfigured();
  }
}

export const adminAuth = () => getAuth(app());
export const adminDb = () => getFirestore(app());
