// Delivers a one-time code by email (server only).
//
//   OTP_EMAIL_PROVIDER=resend   real delivery through Resend's HTTPS API
//   OTP_EMAIL_FROM              verified sender, e.g. "UniFix <no-reply@your-domain>"
//   RESEND_API_KEY              the provider's secret key (never sent to the browser)
//
// Nothing is delivered (and registration by email is unavailable) until these
// are set. A "capture" transport exists for automated tests only: it is
// refused unless the Firebase emulators are running and the build is not a
// production build, so a code can never be diverted away from a real inbox.

import { adminDb, usingEmulators } from "./admin";

export class MailNotConfigured extends Error {
  constructor() {
    super("Email delivery is not configured.");
    this.name = "MailNotConfigured";
  }
}
export class MailFailed extends Error {
  constructor() {
    super("The email could not be delivered.");
    this.name = "MailFailed";
  }
}

export function emailDeliveryConfigured(): boolean {
  const p = process.env.OTP_EMAIL_PROVIDER;
  if (p === "resend") return !!process.env.RESEND_API_KEY && !!process.env.OTP_EMAIL_FROM;
  if (p === "capture") return usingEmulators() && process.env.NODE_ENV !== "production";
  return false;
}

export async function sendOtpEmail(to: string, code: string, challengeId: string): Promise<void> {
  if (!emailDeliveryConfigured()) throw new MailNotConfigured();
  if (process.env.OTP_EMAIL_PROVIDER === "capture") {
    await adminDb().collection("__otpCapture").doc(challengeId).set({ to, code, at: Date.now() });
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.OTP_EMAIL_FROM,
      to: [to],
      subject: "Your UniFix verification code",
      text: `Your UniFix verification code is ${code}.\n\nIt expires in 10 minutes. If you didn't ask for it, you can ignore this email: no account is created without the code.`,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res || !res.ok) throw new MailFailed();
}
