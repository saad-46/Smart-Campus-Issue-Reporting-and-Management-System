// ============================================
// Authentication Helper Functions
// ============================================
// Wraps Firebase Auth operations and manages user
// profile documents in Firestore.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User, UserRole } from "@/types";
import { LIMITS } from "./constants";
import { logError } from "./errors";
import { normalizeUser } from "./models";
import { cleanText, validateRegistration } from "./validation";

const USERS_COLLECTION = "users";
const ADMINS_COLLECTION = "admins";

/** Write the Firestore profile for a freshly created account. */
async function createProfile(
  firebaseUser: FirebaseUser,
  name: string,
  requestWorkerAccess: boolean
): Promise<User> {
  const createdAt = new Date();
  // Use the address Firebase Auth recorded: the security rules require the
  // profile's email to match the signed-in token exactly.
  const email = firebaseUser.email ?? "";

  // Every account starts as a plain user. Worker access is a request an
  // admin must approve; the rules reject anything else.
  await setDoc(doc(db, USERS_COLLECTION, firebaseUser.uid), {
    id: firebaseUser.uid,
    name,
    email,
    role: "user",
    roles: ["user"],
    activeRole: "user",
    createdAt: createdAt.toISOString(),
    ...(requestWorkerAccess ? { workerRequest: "pending" } : {}),
  });

  return {
    id: firebaseUser.uid,
    name,
    email,
    role: "user",
    activeRole: "user",
    createdAt,
    earnings: 0,
    workerRequest: requestWorkerAccess ? "pending" : undefined,
  };
}

/**
 * Register a new user with email/password and store their profile in Firestore.
 * Choosing "worker" files a request for worker access; the account is a
 * plain user until an admin approves it. Admin access is granted separately
 * (see firestore.rules).
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  role: UserRole = "user"
): Promise<User> {
  const input = validateRegistration({ email, password, name, role });

  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(credential.user, { displayName: input.name });
  const profile = await createProfile(credential.user, input.name, input.role === "worker");

  // Best effort: a failed email must not undo a successful registration.
  sendEmailVerification(credential.user).catch((err) => logError("sendEmailVerification", err));
  return profile;
}

/** Send the verification email again to the signed-in user. */
export async function resendVerificationEmail(): Promise<void> {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser);
}

/** Re-read the signed-in user from Firebase Auth; returns whether the email is now verified. */
export async function refreshEmailVerified(): Promise<boolean> {
  if (!auth.currentUser) return false;
  await auth.currentUser.reload();
  return auth.currentUser.emailVerified;
}

/**
 * Create a default profile for an account that has none — e.g. registration
 * was interrupted after the Auth user was created but before the profile
 * was written. Without this the account would be permanently unusable.
 */
export async function createMissingProfile(firebaseUser: FirebaseUser): Promise<User> {
  const fallbackName = firebaseUser.email?.split("@")[0] ?? "User";
  const name = cleanText(firebaseUser.displayName || fallbackName).slice(0, LIMITS.name) || "User";
  return createProfile(firebaseUser, name, false);
}

/**
 * Sign in an existing user with email/password.
 */
export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Send a password-reset email. Firebase answers the same way whether or not
 * the address has an account (with email-enumeration protection on), and
 * the UI shows the same message either way.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  return firebaseSignOut(auth);
}

/**
 * Fetch a user's profile from Firestore by their UID.
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  const docSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
  return docSnap.exists() ? normalizeUser(docSnap.id, docSnap.data()) : null;
}

/**
 * Whether this account has been granted admin access (a document at
 * admins/{uid}). The security rules perform the same check server-side.
 */
export async function hasAdminGrant(uid: string): Promise<boolean> {
  const docSnap = await getDoc(doc(db, ADMINS_COLLECTION, uid));
  return docSnap.exists();
}

/** Persist which of the account's granted roles is currently active. */
export async function setActiveRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, uid), { activeRole: role });
}
