// ============================================
// Authentication Helper Functions
// ============================================
// Wraps Firebase Auth operations and manages user
// profile documents in Firestore.

import {
  EmailAuthProvider,
  linkWithCredential,
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
import { StudentProfile, User, UserRole } from "@/types";
import { DEPARTMENTS } from "./constants";
import { ValidationError, logError } from "./errors";
import { bindVerifiedEmail } from "./otpClient";
import { normalizePhone } from "./phone";
import { normalizeUser } from "./models";
import { validateRegistration, validateStudentProfile } from "./validation";

const USERS_COLLECTION = "users";
const ADMINS_COLLECTION = "admins";

export type Verification = { via: "email"; ticket: string } | { via: "phone" };

export interface RegistrationRequest {
  /** What the person signed up to be. "admin" and "worker" are requests; neither grants anything by itself. */
  kind: "student" | "worker" | "admin";
  name: string;
  email: string;
  password: string;
  phone: string;
  verification: Verification;
  student?: Partial<Record<keyof StudentProfile, string>>;
  workArea?: string;
}

/** Write the Firestore profile for a freshly created, already verified account. */
async function createProfile(
  firebaseUser: FirebaseUser,
  name: string,
  extra: { phone: string; verifiedVia: "email" | "phone"; student?: StudentProfile; workArea?: string; workerRequest?: boolean; adminRequest?: boolean }
): Promise<User> {
  const createdAt = new Date();
  // Use the address Firebase Auth recorded: the security rules require the
  // profile's email to match the signed-in token exactly.
  const email = firebaseUser.email ?? "";

  // Every account starts as a plain user. Worker and administrator access are
  // requests someone with authority must approve; the rules reject anything else.
  await setDoc(doc(db, USERS_COLLECTION, firebaseUser.uid), {
    id: firebaseUser.uid,
    name,
    email,
    role: "user",
    roles: ["user"],
    activeRole: "user",
    createdAt: createdAt.toISOString(),
    phone: extra.phone,
    verifiedVia: extra.verifiedVia,
    ...(extra.workerRequest ? { workerRequest: "pending", workArea: extra.workArea } : {}),
    ...(extra.adminRequest ? { adminRequest: "pending" } : {}),
    ...(extra.student ?? {}),
  });

  return {
    id: firebaseUser.uid,
    name,
    email,
    role: "user",
    activeRole: "user",
    createdAt,
    earnings: 0,
    workerRequest: extra.workerRequest ? "pending" : undefined,
    adminRequest: extra.adminRequest ? "pending" : undefined,
    workArea: extra.workerRequest ? extra.workArea : undefined,
    student: extra.student,
    phone: extra.phone,
    verifiedVia: extra.verifiedVia,
  };
}

/**
 * Create the account and its profile. The contact must already be verified:
 *  - email: a one-time ticket from /api/otp/email/verify, spent on the server
 *    after the account exists (it adds the claim firestore.rules require);
 *  - phone: the browser is already signed in as that verified phone number;
 *    the email + PIN are linked to it.
 * Only the caller's request is trusted for what was asked, never for what is
 * granted: the profile is always a plain user (see firestore.rules).
 */
export async function registerAccount(req: RegistrationRequest): Promise<User> {
  const input = validateRegistration({ email: req.email, password: req.password, name: req.name, role: req.kind === "worker" ? "worker" : "user" });
  const phone = normalizePhone(req.phone);
  if (!phone) throw new ValidationError("Enter a valid phone number.");
  const student = req.kind === "student" ? validateStudentProfile(req.student ?? {}) : undefined;
  if (req.kind === "worker" && !DEPARTMENTS.includes(req.workArea ?? "")) throw new ValidationError("Choose the team you work with.");

  let user: FirebaseUser;
  if (req.verification.via === "email") {
    try {
      user = (await createUserWithEmailAndPassword(auth, input.email, input.password)).user;
    } catch (err) {
      // An earlier attempt created the account but never finished its profile: pick it up where it stopped.
      if ((err as { code?: string }).code !== "auth/email-already-in-use") throw err;
      const existing = (await signInWithEmailAndPassword(auth, input.email, input.password).catch(() => null))?.user;
      if (!existing || (await getDoc(doc(db, USERS_COLLECTION, existing.uid)).then((d) => d.exists()).catch(() => true))) {
        if (existing) await firebaseSignOut(auth).catch(() => undefined);
        throw err;
      }
      user = existing;
    }
    await bindVerifiedEmail(req.verification.ticket);
  } else {
    const current = auth.currentUser;
    if (!current || !current.phoneNumber || current.phoneNumber !== phone) throw new ValidationError("Verify your phone number first.");
    if (!current.email) await linkWithCredential(current, EmailAuthProvider.credential(input.email, input.password));
    await current.getIdToken(true);
    user = current;
  }

  await updateProfile(user, { displayName: input.name });
  const profile = await createProfile(user, input.name, {
    phone,
    verifiedVia: req.verification.via,
    student,
    workArea: req.workArea,
    workerRequest: req.kind === "worker",
    adminRequest: req.kind === "admin",
  });

  // A phone-verified account has not proved its email yet; send the standard link (best effort).
  if (req.verification.via === "phone") sendEmailVerification(user).catch((err) => logError("sendEmailVerification", err));
  return profile;
}

/**
 * Save the signed-in student's own details (also used to complete the profile of
 * an account created before these fields existed). firestore.rules lets only the
 * owner write exactly these four fields, together.
 */
export async function saveStudentProfile(uid: string, input: Partial<Record<keyof StudentProfile, string>>): Promise<StudentProfile> {
  const student = validateStudentProfile(input);
  await updateDoc(doc(db, USERS_COLLECTION, uid), { ...student });
  return student;
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
