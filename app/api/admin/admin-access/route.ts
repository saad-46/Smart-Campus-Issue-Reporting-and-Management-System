// POST /api/admin/admin-access  { userId, decision: "approve" | "reject" }
// Authorization: Bearer <ID token of an existing administrator>
//
// The only way an administrator request becomes administrator access besides
// the Firebase console. The caller must already have an admins/{uid} document
// (checked here with the Admin SDK, not taken from the token or the client);
// the target must have a pending request and a verified contact. firestore.rules
// still forbid every client write to admins/, so this route is the single door.

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/server/admin";
import { fail, readJson, verifiedCaller } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: Record<string, unknown>, status: number) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  try {
    const caller = await verifiedCaller(req);
    if (!caller) return json({ error: "Your session has expired. Please sign in again.", code: "unauthenticated" }, 401);
    const db = adminDb();
    if (!(await db.collection("admins").doc(caller.uid).get()).exists) return json({ error: "Only an administrator can do that.", code: "forbidden" }, 403);

    const body = await readJson(req);
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const decision = body?.decision;
    if (!/^[A-Za-z0-9]{6,128}$/.test(userId) || (decision !== "approve" && decision !== "reject")) return json({ error: "That request isn't valid.", code: "invalid" }, 400);
    if (userId === caller.uid) return json({ error: "You can't decide your own request.", code: "forbidden" }, 403);

    const ref = db.collection("users").doc(userId);
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.get("adminRequest") !== "pending") return "not-pending" as const;
      if (decision === "approve") {
        const target = await adminAuth().getUser(userId).catch(() => null);
        if (!target || !(target.emailVerified || target.phoneNumber)) return "unverified" as const;
        tx.set(db.collection("admins").doc(userId), { grantedBy: caller.uid, grantedAt: FieldValue.serverTimestamp(), via: "request" });
      }
      tx.update(ref, { adminRequest: decision === "approve" ? "approved" : "rejected" });
      return "done" as const;
    });
    if (outcome === "not-pending") return json({ error: "That request has already been handled.", code: "not-pending" }, 409);
    if (outcome === "unverified") return json({ error: "That account hasn't verified a contact method.", code: "unverified" }, 409);
    return json({ ok: true }, 200);
  } catch (err) {
    return fail(err);
  }
}
