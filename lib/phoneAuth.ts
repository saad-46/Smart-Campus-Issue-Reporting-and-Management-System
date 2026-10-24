// Phone verification through Firebase Phone Authentication.
//
// Firebase sends the SMS and checks the code; confirming it signs the browser
// in as a phone-identified account whose ID token then carries `phone_number`
// (the proof firestore.rules look for). Registration links the email + PIN to
// that same account, so there is one account per person.
//
// Off unless NEXT_PUBLIC_PHONE_OTP_ENABLED=true: SMS needs the Phone provider
// enabled in Firebase, a billing plan that allows SMS, and an authorised
// domain; see docs/REGISTRATION_OTP.md. When off, the page offers email only.

import { ConfirmationResult, RecaptchaVerifier, getAdditionalUserInfo, signInWithPhoneNumber, signOut } from "firebase/auth";
import { auth } from "./firebase";
import { ValidationError } from "./errors";

export const phoneOtpEnabled = process.env.NEXT_PUBLIC_PHONE_OTP_ENABLED === "true";

// Display only. Firebase test numbers are defined in the (test) Firebase project, which is
// what makes them work; this list just labels them in the UI, and is unset in production.
const TEST_NUMBERS = (process.env.NEXT_PUBLIC_TEST_PHONE_NUMBERS ?? "").split(",").map((n) => n.trim()).filter(Boolean);
export const isLabelledTestNumber = (e164: string | null) => !!e164 && TEST_NUMBERS.includes(e164);

let verifier: RecaptchaVerifier | null = null;

function resetVerifier() {
  try {
    verifier?.clear();
  } catch {
    /* already gone */
  }
  verifier = null;
}

const PHONE_MESSAGES: Record<string, string> = {
  "auth/invalid-phone-number": "That phone number doesn't look right.",
  "auth/missing-phone-number": "Enter your phone number.",
  "auth/invalid-verification-code": "That code isn't right. Check it and try again.",
  "auth/code-expired": "That code has expired. Ask for a new one.",
  "auth/session-expired": "That code has expired. Ask for a new one.",
  "auth/too-many-requests": "Too many attempts. Please wait a while and try again.",
  "auth/quota-exceeded": "We can't send text messages right now. Please verify your email instead.",
  "auth/captcha-check-failed": "We couldn't confirm you're not a robot. Please try again.",
  "auth/operation-not-allowed": "Phone verification isn't available right now. Please verify your email instead.",
  "auth/network-request-failed": "Network error. Please check your connection and try again.",
};

function friendly(err: unknown): ValidationError {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  return new ValidationError(PHONE_MESSAGES[code] ?? "We couldn't verify that phone number. Please try again.");
}

/** Send the SMS. `container` is the id of an empty element for the invisible reCAPTCHA. */
export async function sendPhoneOtp(phoneE164: string, container: string): Promise<ConfirmationResult> {
  if (!phoneOtpEnabled) throw new ValidationError("Phone verification isn't available yet. Please verify your email instead.");
  try {
    resetVerifier();
    verifier = new RecaptchaVerifier(auth, container, { size: "invisible" });
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (err) {
    resetVerifier();
    throw friendly(err);
  }
}

/**
 * Check the SMS code. A number that already belongs to an account must sign in
 * instead: that sign-in is undone here so registration cannot take over (or be
 * confused with) someone else's account.
 */
export async function confirmPhoneOtp(result: ConfirmationResult, code: string): Promise<void> {
  try {
    const credential = await result.confirm(code.trim());
    // `isNewUser` is Firebase's own statement about whether this number had an account.
    if (getAdditionalUserInfo(credential)?.isNewUser === false) {
      await signOut(auth);
      throw new ValidationError("That phone number is already registered. Please sign in instead.");
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw friendly(err);
  } finally {
    resetVerifier();
  }
}

/** Drop a half-finished phone sign-in (the person left the form). */
export async function abandonPhoneSession(): Promise<void> {
  resetVerifier();
  const user = auth.currentUser;
  if (user && user.phoneNumber && !user.email) await signOut(auth).catch(() => undefined);
}
