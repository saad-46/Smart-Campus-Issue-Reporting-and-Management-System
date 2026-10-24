// POST /api/otp/email/verify  { challengeId, email, code }
// Checks the code on the server. A correct code returns a one-time ticket
// that only /api/register/complete can spend, and only for this address.

import { NextResponse } from "next/server";
import { fail, otpSecret, readJson } from "@/lib/server/http";
import { OtpError, verifyChallenge } from "@/lib/server/otp";
import { firestoreOtpStore } from "@/lib/server/otpFirestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (!body) throw new OtpError("invalid", "That code isn't right. Check it and try again.");
    const { ticket } = await verifyChallenge({
      store: firestoreOtpStore(),
      secret: otpSecret(),
      challengeId: String(body.challengeId ?? ""),
      email: String(body.email ?? ""),
      code: String(body.code ?? ""),
    });
    return NextResponse.json({ ticket }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return fail(err);
  }
}
