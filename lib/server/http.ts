import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { adminAuth, AdminNotConfigured, usingEmulators } from "./admin";
import { MailFailed, MailNotConfigured } from "./mailer";
import { OtpError } from "./otp";

const MAX_BODY_BYTES = 4 * 1024;

/** The server-side secret that keys every OTP hash. Required; shorter than 32 characters is refused. */
export function otpSecret(): string {
  const s = process.env.OTP_SECRET;
  if (!s || s.length < 32) throw new AdminNotConfigured();
  return s;
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The caller's address as the platform reports it (Vercel sets x-forwarded-for). Used only as a rate-limit key. */
export function clientIp(req: Request): string {
  // Automated tests give each scenario its own address so they do not share one hourly cap. Honoured only
  // against the local emulators in a non-production build; on the real service the header is ignored.
  if (usingEmulators() && process.env.NODE_ENV !== "production") {
    const test = req.headers.get("x-otp-test-ip");
    if (test) return test.slice(0, 64);
  }
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || "unknown";
}

export const ipKey = (secret: string, ip: string) => createHmac("sha256", secret).update(`ip\u0000${ip}`).digest("hex").slice(0, 32);

/** Verify the Firebase ID token in the Authorization header. Null when missing, invalid, expired or revoked. */
export async function verifiedCaller(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  try {
    return await adminAuth().verifyIdToken(token, true);
  } catch {
    return null;
  }
}

export function fail(err: unknown): NextResponse {
  if (err instanceof OtpError) {
    const status = err.code === "throttled" || err.code === "cooldown" ? 429 : 400;
    const res = NextResponse.json({ error: err.message, code: err.code, retryAfterSeconds: err.retryAfterSeconds }, { status });
    if (err.retryAfterSeconds) res.headers.set("Retry-After", String(err.retryAfterSeconds));
    return res;
  }
  if (err instanceof MailNotConfigured || err instanceof AdminNotConfigured) {
    return NextResponse.json({ error: "Email verification isn't available right now. Please try again later.", code: "unavailable" }, { status: 503 });
  }
  if (err instanceof MailFailed) {
    return NextResponse.json({ error: "We couldn't send the email. Check the address and try again.", code: "delivery" }, { status: 502 });
  }
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "error" }, { status: 500 });
}
