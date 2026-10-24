// Browser side of email verification. The code is checked on the server; this
// file only carries messages to and from it. Nothing here can mark an address
// verified: the proof is a one-time ticket the server issues, which the server
// itself later turns into a claim on the account (/api/register/complete).

import { auth } from "./firebase";
import { ValidationError } from "./errors";

export class OtpRequestError extends ValidationError {
  constructor(message: string, public code: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = "OtpRequestError";
  }
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new OtpRequestError("Network error. Please check your connection and try again.", "network");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; retryAfterSeconds?: number } & Record<string, unknown>;
  if (!res.ok) throw new OtpRequestError(data.error || "Something went wrong. Please try again.", data.code || "error", data.retryAfterSeconds);
  return data as T;
}

export interface EmailChallenge {
  challengeId: string;
  cooldownSeconds: number;
  expiresInSeconds: number;
}

export const sendEmailOtp = (email: string) => post<EmailChallenge>("/api/otp/email/send", { email });

export async function verifyEmailOtp(input: { challengeId: string; email: string; code: string }): Promise<string> {
  const { ticket } = await post<{ ticket: string }>("/api/otp/email/verify", input);
  return ticket;
}

/** After the account exists: ask the server to attach the verified address to it, then pick up the new claim. */
export async function bindVerifiedEmail(ticket: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new OtpRequestError("Your session has expired. Please try again.", "unauthenticated");
  await post("/api/register/complete", { ticket }, await user.getIdToken());
  await user.getIdToken(true);
}

/** Ask the server to approve or decline someone's administrator request (administrators only). */
export async function decideAdminAccess(userId: string, decision: "approve" | "reject"): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new OtpRequestError("Your session has expired. Please sign in again.", "unauthenticated");
  await post("/api/admin/admin-access", { userId, decision }, await user.getIdToken());
}
