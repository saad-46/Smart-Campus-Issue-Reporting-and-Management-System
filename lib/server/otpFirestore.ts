// Firestore-backed OtpStore. The collections below are not matched by any
// rule in firestore.rules, so browsers can neither read nor write them; only
// this server code (Admin SDK) can. Every operation is a transaction.

import { adminDb } from "./admin";
import type { Challenge, OtpStore, Ticket } from "./otp";

const CHALLENGES = "otpChallenges";
const TICKETS = "registrationTickets";
const LIMITS = "otpLimits";

export function firestoreOtpStore(): OtpStore {
  const db = adminDb();
  return {
    async hit(key, windowMs, limit, now) {
      const ref = db.collection(LIMITS).doc(key);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists ? (snap.data() as { count: number; resetAt: number }) : null;
        if (!cur || cur.resetAt <= now) {
          tx.set(ref, { count: 1, resetAt: now + windowMs });
          return true;
        }
        if (cur.count >= limit) return false;
        tx.update(ref, { count: cur.count + 1 });
        return true;
      });
    },
    async cooldown(key, ms, now) {
      const ref = db.collection(LIMITS).doc(key);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const until = snap.exists ? Number((snap.data() as { until?: number }).until ?? 0) : 0;
        if (until > now) return Math.ceil((until - now) / 1000);
        tx.set(ref, { until: now + ms, resetAt: now + ms });
        return 0;
      });
    },
    async mutateChallenge(id, fn) {
      const ref = db.collection(CHALLENGES).doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const { next, result } = fn(snap.exists ? (snap.data() as Challenge) : null);
        if (next) tx.set(ref, next);
        else if (snap.exists) tx.delete(ref);
        return result;
      });
    },
    async mutateTicket(id, fn) {
      const ref = db.collection(TICKETS).doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const { next, result } = fn(snap.exists ? (snap.data() as Ticket) : null);
        if (next) tx.set(ref, next);
        else if (snap.exists) tx.delete(ref);
        return result;
      });
    },
  };
}
