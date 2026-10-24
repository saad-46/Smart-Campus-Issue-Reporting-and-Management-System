// ============================================
// Email OTP challenges (server only)
// ============================================
// A challenge is created when a code is emailed and consumed by a correct
// code. The code itself is never stored: only an HMAC bound to the challenge
// id and the contact, so a leaked database row cannot be replayed against
// another address or challenge. Every limit (expiry, attempts, cooldown,
// hourly caps) is enforced here, on the server, against a store the browser
// cannot reach (the Firestore rules deny these collections to all clients).

import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";

export const OTP_LIMITS = {
  length: 6,
  ttlMs: 10 * 60_000,
  maxAttempts: 5,
  resendCooldownMs: 60_000,
  perContactPerHour: 5,
  perIpPerHour: 20,
  ticketTtlMs: 15 * 60_000,
} as const;

export type OtpErrorCode = "invalid-contact" | "throttled" | "cooldown" | "invalid" | "expired" | "used" | "locked" | "not-found" | "ticket-invalid";

/** The message is safe to show; `code` lets the route choose a status. */
export class OtpError extends Error {
  constructor(public code: OtpErrorCode, message: string, public retryAfterSeconds?: number) {
    super(message);
    this.name = "OtpError";
  }
}

export interface Challenge {
  id: string;
  contactHash: string;
  codeHash: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  used: boolean;
}

export interface Ticket {
  contactHash: string;
  expiresAt: number;
  used: boolean;
}

/** Atomic read-modify-write on one record: `fn` sees the current value (or null) and returns the next one plus a result. */
export type Mutate<T> = <R>(id: string, fn: (current: T | null) => { next: T | null; result: R }) => Promise<R>;

export interface OtpStore {
  /** Fixed-window counter: returns false (and does not count) once `limit` hits were made in the window. */
  hit(key: string, windowMs: number, limit: number, now: number): Promise<boolean>;
  /** Returns the seconds still to wait, or 0 after starting a new cooldown. */
  cooldown(key: string, ms: number, now: number): Promise<number>;
  mutateChallenge: Mutate<Challenge>;
  mutateTicket: Mutate<Ticket>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function isAcceptableEmail(email: string): boolean {
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

const mac = (secret: string, ...parts: string[]) => createHmac("sha256", secret).update(parts.join("\u0000")).digest("hex");

export const contactHash = (secret: string, email: string) => mac(secret, "contact", normalizeEmail(email));
export const codeHash = (secret: string, id: string, email: string, code: string) => mac(secret, "code", id, normalizeEmail(email), code);
export const ticketHash = (secret: string, ticket: string) => mac(secret, "ticket", ticket);
const limiterKey = (secret: string, scope: string, value: string, bucket: number) => mac(secret, "limit", scope, value, String(bucket));

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function newCode(): string {
  return String(randomInt(0, 10 ** OTP_LIMITS.length)).padStart(OTP_LIMITS.length, "0");
}

export interface IssueResult {
  challengeId: string;
  cooldownSeconds: number;
  expiresInSeconds: number;
}

/**
 * Throttle, create a challenge and hand the code to `deliver`. If delivery
 * fails the challenge is voided and the error propagates, so a code that was
 * never sent can't be used and the person can retry.
 */
export async function issueChallenge(opts: {
  store: OtpStore;
  secret: string;
  email: string;
  ip: string;
  now?: number;
  deliver: (email: string, code: string, challengeId: string) => Promise<void>;
}): Promise<IssueResult> {
  const now = opts.now ?? Date.now();
  const email = normalizeEmail(opts.email);
  if (!isAcceptableEmail(email)) throw new OtpError("invalid-contact", "Enter a valid email address.");
  const { store, secret } = opts;
  const cHash = contactHash(secret, email);

  const wait = await store.cooldown(limiterKey(secret, "cooldown", cHash, 0), OTP_LIMITS.resendCooldownMs, now);
  if (wait > 0) throw new OtpError("cooldown", `Please wait ${wait} seconds before asking for another code.`, wait);
  const hour = Math.floor(now / 3_600_000);
  const okContact = await store.hit(limiterKey(secret, "contact", cHash, hour), 3_600_000, OTP_LIMITS.perContactPerHour, now);
  const okIp = await store.hit(limiterKey(secret, "ip", opts.ip || "unknown", hour), 3_600_000, OTP_LIMITS.perIpPerHour, now);
  if (!okContact || !okIp) throw new OtpError("throttled", "Too many codes requested. Please try again later.", 3600);

  const id = randomBytes(16).toString("hex");
  const code = newCode();
  const challenge: Challenge = { id, contactHash: cHash, codeHash: codeHash(secret, id, email, code), createdAt: now, expiresAt: now + OTP_LIMITS.ttlMs, attempts: 0, used: false };
  await store.mutateChallenge(id, () => ({ next: challenge, result: null }));
  try {
    await opts.deliver(email, code, id);
  } catch (err) {
    await store.mutateChallenge(id, () => ({ next: null, result: null }));
    throw err;
  }
  return { challengeId: id, cooldownSeconds: OTP_LIMITS.resendCooldownMs / 1000, expiresInSeconds: OTP_LIMITS.ttlMs / 1000 };
}

/**
 * Check a code. A wrong code costs an attempt; the fifth locks the challenge;
 * a correct code is single use and returns a registration ticket that is only
 * good for the address that was verified.
 */
export async function verifyChallenge(opts: { store: OtpStore; secret: string; challengeId: string; email: string; code: string; now?: number }): Promise<{ ticket: string }> {
  const now = opts.now ?? Date.now();
  const email = normalizeEmail(opts.email);
  const code = typeof opts.code === "string" ? opts.code.trim() : "";
  const { store, secret } = opts;
  if (!/^[a-f0-9]{32}$/.test(opts.challengeId) || !isAcceptableEmail(email) || !new RegExp(`^\\d{${OTP_LIMITS.length}}$`).test(code)) {
    throw new OtpError("invalid", "That code isn't right. Check it and try again.");
  }
  const outcome = await store.mutateChallenge<OtpErrorCode | "ok">(opts.challengeId, (c) => {
    if (!c || c.contactHash !== contactHash(secret, email)) return { next: c, result: "not-found" };
    if (c.used) return { next: c, result: "used" };
    if (c.expiresAt <= now) return { next: c, result: "expired" };
    if (c.attempts >= OTP_LIMITS.maxAttempts) return { next: c, result: "locked" };
    if (!safeEqual(c.codeHash, codeHash(secret, c.id, email, code))) {
      return { next: { ...c, attempts: c.attempts + 1 }, result: "invalid" };
    }
    return { next: { ...c, used: true }, result: "ok" };
  });
  if (outcome === "ok") {
    const ticket = randomBytes(24).toString("base64url");
    await store.mutateTicket(ticketHash(secret, ticket), () => ({
      next: { contactHash: contactHash(secret, email), expiresAt: now + OTP_LIMITS.ticketTtlMs, used: false },
      result: null,
    }));
    return { ticket };
  }
  const messages: Record<string, string> = {
    invalid: "That code isn't right. Check it and try again.",
    "not-found": "That code isn't right. Check it and try again.",
    used: "That code was already used. Ask for a new one.",
    expired: "That code has expired. Ask for a new one.",
    locked: "Too many wrong attempts. Ask for a new code.",
  };
  throw new OtpError(outcome as OtpErrorCode, messages[outcome] ?? messages.invalid);
}

/** Spend a ticket for the address on the signed-in token. Returns true exactly once per ticket. */
export async function consumeTicket(opts: { store: OtpStore; secret: string; ticket: string; email: string; now?: number }): Promise<boolean> {
  const now = opts.now ?? Date.now();
  if (typeof opts.ticket !== "string" || opts.ticket.length < 20 || opts.ticket.length > 80) return false;
  const want = contactHash(opts.secret, opts.email);
  return opts.store.mutateTicket<boolean>(ticketHash(opts.secret, opts.ticket), (t) => {
    if (!t || t.used || t.expiresAt <= now || !safeEqual(t.contactHash, want)) return { next: t, result: false };
    return { next: { ...t, used: true }, result: true };
  });
}

/** In-memory store for tests and local use. */
export function memoryStore(): OtpStore & { challenges: Map<string, Challenge>; tickets: Map<string, Ticket> } {
  const challenges = new Map<string, Challenge>();
  const tickets = new Map<string, Ticket>();
  const counters = new Map<string, { count: number; resetAt: number }>();
  const cools = new Map<string, number>();
  return {
    challenges,
    tickets,
    async hit(key, windowMs, limit, now) {
      const cur = counters.get(key);
      if (!cur || cur.resetAt <= now) {
        counters.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (cur.count >= limit) return false;
      cur.count++;
      return true;
    },
    async cooldown(key, ms, now) {
      const until = cools.get(key) ?? 0;
      if (until > now) return Math.ceil((until - now) / 1000);
      cools.set(key, now + ms);
      return 0;
    },
    async mutateChallenge(id, fn) {
      const { next, result } = fn(challenges.get(id) ?? null);
      if (next) challenges.set(id, next);
      else challenges.delete(id);
      return result;
    },
    async mutateTicket(id, fn) {
      const { next, result } = fn(tickets.get(id) ?? null);
      if (next) tickets.set(id, next);
      else tickets.delete(id);
      return result;
    },
  };
}
