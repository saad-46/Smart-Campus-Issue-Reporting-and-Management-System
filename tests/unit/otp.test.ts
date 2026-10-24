import { describe, expect, it } from "vitest";
import { OTP_LIMITS, OtpError, consumeTicket, issueChallenge, memoryStore, newCode, normalizeEmail, verifyChallenge } from "@/lib/server/otp";

const SECRET = "test-secret-test-secret-test-secret-123";
const EMAIL = "Student@Example.com";

async function issue(store = memoryStore(), over: Partial<Parameters<typeof issueChallenge>[0]> = {}, sent: { code?: string; to?: string } = {}) {
  const result = await issueChallenge({
    store,
    secret: SECRET,
    email: EMAIL,
    ip: "ip-1",
    now: 1_000_000,
    deliver: async (to, code) => {
      sent.to = to;
      sent.code = code;
    },
    ...over,
  });
  return { store, result, sent };
}

const verify = (store: ReturnType<typeof memoryStore>, challengeId: string, code: string, over: Partial<Parameters<typeof verifyChallenge>[0]> = {}) =>
  verifyChallenge({ store, secret: SECRET, challengeId, email: EMAIL, code, now: 1_000_000 + 1000, ...over });

const code = (e: unknown) => (e instanceof OtpError ? e.code : "other");
async function rejection(p: Promise<unknown>) {
  try {
    await p;
    return null;
  } catch (e) {
    return e;
  }
}

describe("email OTP: issuing", () => {
  it("makes a six-digit code, delivers it to the normalised address, and stores only a hash", async () => {
    const { store, result, sent } = await issue();
    expect(sent.code).toMatch(/^\d{6}$/);
    expect(sent.to).toBe("student@example.com");
    expect(result.expiresInSeconds).toBe(600);
    const stored = JSON.stringify([...store.challenges.values()]);
    expect(stored).not.toContain(sent.code!);
    expect(stored).not.toContain("student@example.com");
  });

  it("generates codes with leading zeros preserved and a spread of values", () => {
    const codes = new Set(Array.from({ length: 200 }, newCode));
    expect([...codes].every((c) => /^\d{6}$/.test(c))).toBe(true);
    expect(codes.size).toBeGreaterThan(150);
  });

  it("rejects malformed addresses without sending anything", async () => {
    const sent: { code?: string } = {};
    for (const email of ["", "nope", "a@b", " ", "x".repeat(260) + "@e.com"]) {
      expect(code(await rejection(issue(memoryStore(), { email }, sent)))).toBe("invalid-contact");
    }
    expect(sent.code).toBeUndefined();
    expect(normalizeEmail("  A@B.Co ")).toBe("a@b.co");
  });

  it("enforces the resend cooldown, then allows another code", async () => {
    const store = memoryStore();
    await issue(store);
    const err = await rejection(issue(store, { now: 1_000_000 + 30_000 }));
    expect(code(err)).toBe("cooldown");
    expect((err as OtpError).retryAfterSeconds).toBe(30);
    await expect(issue(store, { now: 1_000_000 + OTP_LIMITS.resendCooldownMs + 1 })).resolves.toBeTruthy();
  });

  it("caps codes per address per hour and per caller per hour", async () => {
    const store = memoryStore();
    let t = 1_000_000;
    for (let i = 0; i < OTP_LIMITS.perContactPerHour; i++) {
      await issue(store, { now: t });
      t += OTP_LIMITS.resendCooldownMs + 1;
    }
    expect(code(await rejection(issue(store, { now: t })))).toBe("throttled");

    const ipStore = memoryStore();
    t = 1_000_000;
    for (let i = 0; i < OTP_LIMITS.perIpPerHour; i++) await issue(ipStore, { now: t, email: `u${i}@example.com`, ip: "same-ip" });
    expect(code(await rejection(issue(ipStore, { now: t, email: "another@example.com", ip: "same-ip" })))).toBe("throttled");
    await expect(issue(ipStore, { now: t, email: "fresh@example.com", ip: "different-ip" })).resolves.toBeTruthy();
  });

  it("voids the challenge when delivery fails, so an unsent code cannot be used", async () => {
    const store = memoryStore();
    await expect(issue(store, { deliver: async () => { throw new Error("provider down"); } })).rejects.toThrow("provider down");
    expect(store.challenges.size).toBe(0);
  });
});

describe("email OTP: verifying", () => {
  it("accepts the right code once and returns a ticket", async () => {
    const { store, result, sent } = await issue();
    const { ticket } = await verify(store, result.challengeId, sent.code!);
    expect(ticket.length).toBeGreaterThan(20);
    expect(code(await rejection(verify(store, result.challengeId, sent.code!)))).toBe("used");
  });

  it("rejects wrong codes, counts attempts, and locks after the limit even for the right code", async () => {
    const { store, result, sent } = await issue();
    const wrong = sent.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < OTP_LIMITS.maxAttempts; i++) expect(code(await rejection(verify(store, result.challengeId, wrong)))).toBe("invalid");
    expect(code(await rejection(verify(store, result.challengeId, sent.code!)))).toBe("locked");
  });

  it("rejects an expired code", async () => {
    const { store, result, sent } = await issue();
    expect(code(await rejection(verify(store, result.challengeId, sent.code!, { now: 1_000_000 + OTP_LIMITS.ttlMs + 1 })))).toBe("expired");
  });

  it("is bound to the address: another email cannot use the code", async () => {
    const { store, result, sent } = await issue();
    expect(code(await rejection(verify(store, result.challengeId, sent.code!, { email: "attacker@example.com" })))).toBe("not-found");
  });

  it("rejects unknown ids and malformed input without touching a challenge", async () => {
    const { store, result, sent } = await issue();
    expect(code(await rejection(verify(store, "0".repeat(32), sent.code!)))).toBe("not-found");
    for (const bad of ["", "12345", "1234567", "abcdef", "12 345"]) expect(code(await rejection(verify(store, result.challengeId, bad)))).toBe("invalid");
    expect(store.challenges.get(result.challengeId)!.attempts).toBe(0);
    expect(code(await rejection(verify(store, "../etc", sent.code!)))).toBe("invalid");
  });

  it("a newer code does not unlock an older challenge's brute force: each challenge has its own attempts", async () => {
    const store = memoryStore();
    const a = await issue(store);
    const b = await issue(store, { now: 1_000_000 + OTP_LIMITS.resendCooldownMs + 1 });
    expect(a.result.challengeId).not.toBe(b.result.challengeId);
    // A code from one challenge is useless on the other.
    const wrongForB = a.sent.code === b.sent.code ? "999999" : a.sent.code!;
    expect(code(await rejection(verify(store, b.result.challengeId, wrongForB, { now: 1_000_000 + OTP_LIMITS.resendCooldownMs + 2 })))).toBe("invalid");
  });
});

describe("registration tickets", () => {
  it("are single use and only work for the verified address", async () => {
    const { store, result, sent } = await issue();
    const { ticket } = await verify(store, result.challengeId, sent.code!);
    const base = { store, secret: SECRET, ticket, now: 1_000_000 + 2000 };
    expect(await consumeTicket({ ...base, email: "attacker@example.com" })).toBe(false);
    expect(await consumeTicket({ ...base, email: EMAIL })).toBe(true);
    expect(await consumeTicket({ ...base, email: EMAIL })).toBe(false);
  });

  it("expire, and junk tickets are refused", async () => {
    const { store, result, sent } = await issue();
    const { ticket } = await verify(store, result.challengeId, sent.code!);
    expect(await consumeTicket({ store, secret: SECRET, ticket, email: EMAIL, now: 1_000_000 + OTP_LIMITS.ticketTtlMs + 5000 })).toBe(false);
    for (const junk of ["", "x", "a".repeat(200), 5 as unknown as string]) expect(await consumeTicket({ store, secret: SECRET, ticket: junk, email: EMAIL })).toBe(false);
  });

  it("a ticket from a different secret is worthless", async () => {
    const { store, result, sent } = await issue();
    const { ticket } = await verify(store, result.challengeId, sent.code!);
    expect(await consumeTicket({ store, secret: "another-secret-another-secret-another-1", ticket, email: EMAIL, now: 1_000_000 + 2000 })).toBe(false);
  });
});
