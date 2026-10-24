// POST /api/otp/email/send  { email }
// Emails a six-digit code. Public (registration happens before sign-in), so
// it is throttled per address and per caller, and it answers the same way
// whether or not the address already has an account.

import { NextResponse } from "next/server";
import { fail, clientIp, ipKey, otpSecret, readJson } from "@/lib/server/http";
import { sendOtpEmail, emailDeliveryConfigured, MailNotConfigured } from "@/lib/server/mailer";
import { issueChallenge, OtpError } from "@/lib/server/otp";
import { firestoreOtpStore } from "@/lib/server/otpFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (!body) throw new OtpError("invalid-contact", "Enter a valid email address.");
    if (!emailDeliveryConfigured()) throw new MailNotConfigured();
    const secret = otpSecret();
    const result = await issueChallenge({
      store: firestoreOtpStore(),
      secret,
      email: String(body.email ?? ""),
      ip: ipKey(secret, clientIp(req)),
      deliver: (email, code, id) => sendOtpEmail(email, code, id),
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}
