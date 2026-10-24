// POST /api/register/complete  { ticket }   Authorization: Bearer <ID token>
//
// Binds a verified email to the account that was just created. The ticket
// came from /api/otp/email/verify; it is single use, expires, and must belong
// to the same address as the signed-in token. On success the account gets the
// server-set claim `contactVerified: "email"` (and Firebase's emailVerified),
// which firestore.rules require before a profile can be created. A client
// cannot set that claim itself.

import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/server/admin";
import { fail, otpSecret, readJson, verifiedCaller } from "@/lib/server/http";
import { consumeTicket, OtpError } from "@/lib/server/otp";
import { firestoreOtpStore } from "@/lib/server/otpFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const caller = await verifiedCaller(req);
    if (!caller || !caller.email) return NextResponse.json({ error: "Your session has expired. Please try again.", code: "unauthenticated" }, { status: 401 });
    const body = await readJson(req);
    const ok = body ? await consumeTicket({ store: firestoreOtpStore(), secret: otpSecret(), ticket: String(body.ticket ?? ""), email: caller.email }) : false;
    if (!ok) throw new OtpError("ticket-invalid", "Your email verification has expired. Please verify your email again.");
    const auth = adminAuth();
    const user = await auth.getUser(caller.uid);
    await auth.setCustomUserClaims(caller.uid, { ...(user.customClaims ?? {}), contactVerified: "email" });
    if (!user.emailVerified) await auth.updateUser(caller.uid, { emailVerified: true });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}
