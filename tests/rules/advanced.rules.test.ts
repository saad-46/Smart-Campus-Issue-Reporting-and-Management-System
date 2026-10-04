// Security-rules tests for the advanced features: timeline events,
// notifications, feedback, campus locations, SLA config, and the new
// issue fields (AI suggestions, QR location, incident links, assignment).
//
//   npm run test:rules

import { readFileSync } from "fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const ALICE = "alice"; // student
const BOB = "bob"; // another student
const WENDY = "wendy"; // worker
const WALT = "walt"; // another worker
const ADMIN = "admin1";

let env: RulesTestEnvironment;
type Db = ReturnType<RulesTestEnvironment["unauthenticatedContext"]>["firestore"] extends () => infer R ? R : never;

const dbAs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const dbAnon = () => env.unauthenticatedContext().firestore();

function profile(uid: string, role: "user" | "worker") {
  return { id: uid, name: uid, email: `${uid}@example.com`, role, roles: [role], activeRole: role, createdAt: new Date().toISOString() };
}

function newIssue(uid: string, overrides: Record<string, unknown> = {}) {
  return {
    title: "Broken light",
    description: "The light in the corridor flickers",
    location: "Block A",
    category: "Electrical",
    priority: "Medium",
    status: "Open",
    createdBy: uid,
    createdByName: uid,
    assignedTo: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    upvotes: 0,
    upvotedBy: [],
    escalated: false,
    imageUrl: "",
    imageUrls: [],
    thumbnails: [],
    imageCount: 0,
    ...overrides,
  };
}

async function seed(fn: (db: Db) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore() as unknown as Db));
}

async function seedIssue(id: string, data: Record<string, unknown>) {
  await seed(async (db) => {
    await setDoc(doc(db, "issues", id), { ...newIssue(ALICE), createdAt: new Date(), updatedAt: new Date(), ...data });
  });
}

/** Create an issue the way the app does (with the rate-limit stamp), plus optional extra writes. */
function report(uid: string, overrides: Record<string, unknown> = {}, id = "new", extra?: (b: ReturnType<typeof writeBatch>, db: Db) => void) {
  const db = dbAs(uid);
  const batch = writeBatch(db);
  batch.set(doc(db, "issues", id), newIssue(uid, overrides));
  batch.set(doc(db, "rateLimits", uid), { lastIssueAt: serverTimestamp() });
  extra?.(batch, db);
  return batch.commit();
}

const ev = (type: string, actorRole: string, extra: Record<string, unknown> = {}) => ({ type, actorRole, createdAt: serverTimestamp(), ...extra });
const note = (type: string, recipientId: string, senderId: string, extra: Record<string, unknown> = {}) => ({
  type, recipientId, senderId, createdAt: serverTimestamp(), readAt: null, ...extra,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-unifix", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(async () => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "users", ALICE), profile(ALICE, "user"));
    await setDoc(doc(db, "users", BOB), profile(BOB, "user"));
    await setDoc(doc(db, "users", WENDY), profile(WENDY, "worker"));
    await setDoc(doc(db, "users", WALT), profile(WALT, "worker"));
    await setDoc(doc(db, "users", ADMIN), profile(ADMIN, "user"));
    await setDoc(doc(db, "admins", ADMIN), { grantedAt: new Date() });
    await setDoc(doc(db, "campusLocations", "lab-204"), { name: "Lab 204", buildingId: "labs", floor: "2", room: "204", createdAt: new Date() });
  });
});

// ------------------------------------------------------------------
describe("new issue fields", () => {
  it("accepts AI suggestions, a real QR location and a real 'same as' link", async () => {
    await seedIssue("existing", {});
    await assertSucceeds(
      report(ALICE, { aiSummary: "Socket dead in Lab 204", aiConfidence: 0.72, aiDepartment: "Electrical Maintenance", locationId: "lab-204", duplicateOf: "existing" })
    );
  });

  it.each([
    ["confidence above 1", { aiConfidence: 1.5 }],
    ["confidence as text", { aiConfidence: "high" }],
    ["unknown department", { aiDepartment: "Finance Office" }],
    ["over-long summary", { aiSummary: "x".repeat(301) }],
    ["QR location that doesn't exist", { locationId: "nowhere" }],
    ["link to an issue that doesn't exist", { duplicateOf: "ghost" }],
    ["link to itself", { duplicateOf: "new" }],
  ])("rejects %s", async (_n, overrides) => {
    await assertFails(report(ALICE, overrides));
  });

  it("only admins can link reports into an incident, and only to real issues", async () => {
    await seedIssue("master", {});
    await seedIssue("report", { createdBy: BOB });
    await assertFails(updateDoc(doc(dbAs(BOB), "issues", "report"), { duplicateOf: "master" }));
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "report"), { duplicateOf: "master" }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "report"), { duplicateOf: "ghost" }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "report"), { duplicateOf: "report" }));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "issues", "report"), { duplicateOf: "master" }));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "issues", "report"), { duplicateOf: "" }));
  });

  it("admins can assign only approved workers or admins, and not on resolved issues", async () => {
    await seedIssue("open", {});
    await seedIssue("done", { status: "Resolved", assignedTo: WENDY });
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "open"), { assignedTo: BOB }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "open"), { assignedTo: "nobody" }));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "issues", "open"), { assignedTo: WENDY }));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "issues", "open"), { assignedTo: ADMIN }));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "issues", "open"), { assignedTo: "" }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "done"), { assignedTo: WALT }));
  });

  it("a worker still can't assign issues to others", async () => {
    await seedIssue("open", {});
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "open"), { assignedTo: WALT, updatedAt: serverTimestamp() }));
  });
});

// ------------------------------------------------------------------
describe("timeline events", () => {
  it("'reported' is accepted only in the commit that creates the issue, matching its data", async () => {
    await assertSucceeds(
      report(ALICE, { aiConfidence: 0.6 }, "new", (b, db) =>
        b.set(doc(db, "issues", "new", "events", "reported"), ev("reported", "user", { category: "Electrical", priority: "Medium", confidence: 0.6 }))
      )
    );
    // Later, standalone, or a second copy: denied.
    await assertFails(setDoc(doc(dbAs(ALICE), "issues", "new", "events", "reported"), ev("reported", "user", { category: "Electrical", priority: "Medium", confidence: 0.6 })));
  });

  it("a 'reported' event that misstates the category, confidence or role is rejected", async () => {
    const bad = (data: Record<string, unknown>) =>
      report(ALICE, { aiConfidence: 0.6 }, "new", (b, db) => b.set(doc(db, "issues", "new", "events", "reported"), data));
    await assertFails(bad(ev("reported", "user", { category: "Plumbing", priority: "Medium", confidence: 0.6 })));
    await assertFails(bad(ev("reported", "user", { category: "Electrical", priority: "Medium", confidence: 0.99 })));
    await assertFails(bad(ev("reported", "admin", { category: "Electrical", priority: "Medium", confidence: 0.6 })));
    await assertFails(bad({ ...ev("reported", "user", { category: "Electrical", priority: "Medium", confidence: 0.6 }), createdAt: new Date("2020-01-01") }));
  });

  it("status events are tied to the real status change by the assignee", async () => {
    await seedIssue("t", { assignedTo: WENDY });
    const db = dbAs(WENDY);
    const ok = writeBatch(db);
    ok.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    ok.set(doc(db, "issues", "t", "events", "started"), ev("started", "worker"));
    await assertSucceeds(ok.commit());

    // No status change in the commit → no event.
    await assertFails(setDoc(doc(db, "issues", "t", "events", "resolved"), ev("resolved", "worker")));
    // An unrelated student can't write timeline entries.
    await assertFails(setDoc(doc(dbAs(BOB), "issues", "t", "events", "resolved"), ev("resolved", "user")));
  });

  it("a worker can't claim to be an admin on the timeline", async () => {
    await seedIssue("t", { assignedTo: WENDY });
    const db = dbAs(WENDY);
    const b = writeBatch(db);
    b.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    b.set(doc(db, "issues", "t", "events", "started"), ev("started", "admin"));
    await assertFails(b.commit());
  });

  it("'claimed' needs the claim in the same commit; 'assigned' is admin-only", async () => {
    await seedIssue("pool", {});
    const w = dbAs(WENDY);
    const claim = writeBatch(w);
    claim.update(doc(w, "issues", "pool"), { assignedTo: WENDY, updatedAt: serverTimestamp() });
    claim.set(doc(w, "issues", "pool", "events", `claimed-${Date.now()}`), ev("claimed", "worker"));
    await assertSucceeds(claim.commit());

    await seedIssue("open", {});
    const a = dbAs(ADMIN);
    const assign = writeBatch(a);
    assign.update(doc(a, "issues", "open"), { assignedTo: WALT });
    assign.set(doc(a, "issues", "open", "events", `assigned-${Date.now()}`), ev("assigned", "admin"));
    await assertSucceeds(assign.commit());

    await assertFails(setDoc(doc(w, "issues", "open", "events", `assigned-${Date.now()}`), ev("assigned", "worker")));
    await assertFails(setDoc(doc(w, "issues", "open", "events", "assigned-abc"), ev("assigned", "admin")));
  });

  it("events are readable by signed-in users and immutable", async () => {
    await seedIssue("t", {});
    await seed(async (db) => setDoc(doc(db, "issues", "t", "events", "reported"), { type: "reported", actorRole: "user", createdAt: new Date() }));
    await assertSucceeds(getDocs(collection(dbAs(BOB), "issues", "t", "events")));
    await assertFails(getDocs(collection(dbAnon(), "issues", "t", "events")));
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "t", "events", "reported"), { type: "resolved" }));
    await assertFails(deleteDoc(doc(dbAs(ADMIN), "issues", "t", "events", "reported")));
  });
});

// ------------------------------------------------------------------
describe("notifications", () => {
  beforeEach(async () => {
    await seedIssue("t", { createdBy: ALICE, assignedTo: WENDY });
    await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 300, claimStatus: "pending" });
  });

  it("the assignee notifies the reporter in the commit that changes the status", async () => {
    const db = dbAs(WENDY);
    const b = writeBatch(db);
    b.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    b.set(doc(collection(db, "notifications")), note("status_changed", ALICE, WENDY, { issueId: "t", issueTitle: "Broken light", status: "In Progress" }));
    await assertSucceeds(b.commit());
  });

  it("can't be sent without the matching change, to the wrong person, or with a false status", async () => {
    const db = dbAs(WENDY);
    await assertFails(addDoc(collection(db, "notifications"), note("status_changed", ALICE, WENDY, { issueId: "t", issueTitle: "Broken light", status: "Resolved" })));
    const wrongRecipient = writeBatch(db);
    wrongRecipient.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    wrongRecipient.set(doc(collection(db, "notifications")), note("status_changed", BOB, WENDY, { issueId: "t", issueTitle: "Broken light", status: "In Progress" }));
    await assertFails(wrongRecipient.commit());
    const falseStatus = writeBatch(db);
    falseStatus.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    falseStatus.set(doc(collection(db, "notifications")), note("status_changed", ALICE, WENDY, { issueId: "t", issueTitle: "Broken light", status: "Resolved" }));
    await assertFails(falseStatus.commit());
  });

  it("carries no free text and can't impersonate a sender", async () => {
    const db = dbAs(WENDY);
    const withText = writeBatch(db);
    withText.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    withText.set(doc(collection(db, "notifications")), note("status_changed", ALICE, WENDY, { issueId: "t", issueTitle: "Broken light", status: "In Progress", message: "Click here to verify your password" }));
    await assertFails(withText.commit());
    const spoofed = writeBatch(db);
    spoofed.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    spoofed.set(doc(collection(db, "notifications")), note("status_changed", ALICE, ADMIN, { issueId: "t", issueTitle: "Broken light", status: "In Progress" }));
    await assertFails(spoofed.commit());
    const fakeTitle = writeBatch(db);
    fakeTitle.update(doc(db, "issues", "t"), { status: "In Progress", startedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    fakeTitle.set(doc(collection(db, "notifications")), note("status_changed", ALICE, WENDY, { issueId: "t", issueTitle: "Your account is suspended", status: "In Progress" }));
    await assertFails(fakeTitle.commit());
  });

  it("only admins send assignment, claim and worker-access notices, tied to the change", async () => {
    await seedIssue("open", {});
    const a = dbAs(ADMIN);
    const assign = writeBatch(a);
    assign.update(doc(a, "issues", "open"), { assignedTo: WALT });
    assign.set(doc(collection(a, "notifications")), note("issue_assigned", WALT, ADMIN, { issueId: "open", issueTitle: "Broken light" }));
    await assertSucceeds(assign.commit());

    const reject = writeBatch(a);
    reject.update(doc(a, "issues", "claim"), { claimStatus: "rejected" });
    reject.set(doc(collection(a, "notifications")), note("claim_decision", WENDY, ADMIN, { issueId: "claim", issueTitle: "Broken light", decision: "rejected", amount: 300 }));
    await assertSucceeds(reject.commit());

    await seed(async (db) => setDoc(doc(db, "users", "carl"), { ...profile("carl", "user"), workerRequest: "pending" }));
    const access = writeBatch(a);
    access.update(doc(a, "users", "carl"), { role: "worker", roles: ["user", "worker"], activeRole: "worker", workerRequest: "approved" });
    access.set(doc(collection(a, "notifications")), note("worker_access", "carl", ADMIN, { decision: "approved" }));
    await assertSucceeds(access.commit());

    // A worker can't send these, and an admin can't send them without the change.
    await assertFails(addDoc(collection(dbAs(WENDY), "notifications"), note("worker_access", ALICE, WENDY, { decision: "approved" })));
    await assertFails(addDoc(collection(a, "notifications"), note("worker_access", ALICE, ADMIN, { decision: "approved" })));
    await assertFails(addDoc(collection(a, "notifications"), note("issue_assigned", WENDY, ADMIN, { issueId: "t", issueTitle: "Broken light" })));
  });

  it("a claim notice must state the claimed amount", async () => {
    const a = dbAs(ADMIN);
    const b = writeBatch(a);
    b.update(doc(a, "issues", "claim"), { claimStatus: "rejected" });
    b.set(doc(collection(a, "notifications")), note("claim_decision", WENDY, ADMIN, { issueId: "claim", issueTitle: "Broken light", decision: "rejected", amount: 99999 }));
    await assertFails(b.commit());
  });

  it("users read and update only their own notifications, and only to mark them read", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "notifications", "n1"), { type: "status_changed", recipientId: ALICE, senderId: WENDY, issueId: "t", issueTitle: "Broken light", status: "In Progress", createdAt: new Date(), readAt: null });
    });
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "notifications", "n1")));
    await assertSucceeds(getDocs(query(collection(dbAs(ALICE), "notifications"), where("recipientId", "==", ALICE))));
    await assertFails(getDoc(doc(dbAs(BOB), "notifications", "n1")));
    await assertFails(getDocs(collection(dbAs(BOB), "notifications")));
    await assertFails(getDocs(query(collection(dbAs(ADMIN), "notifications"), where("recipientId", "==", ALICE))));

    await assertFails(updateDoc(doc(dbAs(BOB), "notifications", "n1"), { readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "notifications", "n1"), { status: "Resolved" }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "notifications", "n1"), { readAt: new Date("2020-01-01") }));
    await assertSucceeds(updateDoc(doc(dbAs(ALICE), "notifications", "n1"), { readAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "notifications", "n1"), { readAt: serverTimestamp() })); // only once
    await assertFails(deleteDoc(doc(dbAs(BOB), "notifications", "n1")));
    await assertSucceeds(deleteDoc(doc(dbAs(ALICE), "notifications", "n1")));
  });
});

// ------------------------------------------------------------------
describe("feedback", () => {
  const fb = (overrides: Record<string, unknown> = {}) => ({
    issueId: "done", rating: 5, comment: "Fixed quickly", createdBy: ALICE, assignedTo: WENDY, category: "Electrical", createdAt: serverTimestamp(), ...overrides,
  });

  beforeEach(async () => {
    await seedIssue("done", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved" });
    await seedIssue("open", { createdBy: ALICE });
  });

  it("the reporter rates their resolved issue once, with the timeline event", async () => {
    const db = dbAs(ALICE);
    const b = writeBatch(db);
    b.set(doc(db, "feedback", "done"), fb());
    b.set(doc(db, "issues", "done", "events", "feedback"), ev("feedback", "user", { rating: 5 }));
    await assertSucceeds(b.commit());
    await assertFails(setDoc(doc(db, "feedback", "done"), fb({ rating: 1 })));
    await assertFails(updateDoc(doc(db, "feedback", "done"), { rating: 1 }));
    await assertFails(deleteDoc(doc(db, "feedback", "done")));
  });

  it("only the reporter, only once resolved, only truthful copies of the issue", async () => {
    await assertFails(setDoc(doc(dbAs(BOB), "feedback", "done"), fb({ createdBy: BOB })));
    await assertFails(setDoc(doc(dbAs(BOB), "feedback", "done"), fb()));
    await assertFails(setDoc(doc(dbAs(ALICE), "feedback", "open"), fb({ issueId: "open" })));
    await assertFails(setDoc(doc(dbAs(ALICE), "feedback", "done"), fb({ assignedTo: WALT })));
    await assertFails(setDoc(doc(dbAs(ALICE), "feedback", "done"), fb({ category: "Plumbing" })));
    await assertFails(setDoc(doc(dbAs(WENDY), "feedback", "done"), fb({ createdBy: WENDY })));
  });

  it.each([[0], [6], [4.5], ["5"]])("rejects rating %j", async (rating) => {
    await assertFails(setDoc(doc(dbAs(ALICE), "feedback", "done"), fb({ rating })));
  });

  it("rejects an over-long comment", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "feedback", "done"), fb({ comment: "x".repeat(501) })));
  });

  it("is private to its author and admins (not workers or other students)", async () => {
    await seed(async (db) => setDoc(doc(db, "feedback", "done"), { ...fb(), createdAt: new Date() }));
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "feedback", "done")));
    await assertSucceeds(getDoc(doc(dbAs(ADMIN), "feedback", "done")));
    await assertSucceeds(getDocs(collection(dbAs(ADMIN), "feedback")));
    await assertFails(getDoc(doc(dbAs(BOB), "feedback", "done")));
    await assertFails(getDoc(doc(dbAs(WENDY), "feedback", "done")));
    await assertFails(getDocs(collection(dbAs(WENDY), "feedback")));
    await assertSucceeds(getDocs(query(collection(dbAs(ALICE), "feedback"), where("createdBy", "==", ALICE))));
  });

  it("a reporter can check whether their own issue is rated yet, others can't probe", async () => {
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "feedback", "open")));
    await assertFails(getDoc(doc(dbAs(BOB), "feedback", "open")));
  });

  it("a feedback timeline event must match a feedback document created in the same commit", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "issues", "done", "events", "feedback"), ev("feedback", "user", { rating: 5 })));
    const db = dbAs(ALICE);
    const b = writeBatch(db);
    b.set(doc(db, "feedback", "done"), fb({ rating: 2 }));
    b.set(doc(db, "issues", "done", "events", "feedback"), ev("feedback", "user", { rating: 5 }));
    await assertFails(b.commit());
  });
});

// ------------------------------------------------------------------
describe("campus locations (QR)", () => {
  const loc = (overrides: Record<string, unknown> = {}) => ({ name: "Physics Lab", buildingId: "labs", floor: "1", room: "101", createdAt: serverTimestamp(), ...overrides });

  it("admins create and delete; everyone signed in can read", async () => {
    await assertSucceeds(setDoc(doc(dbAs(ADMIN), "campusLocations", "labs-physics-lab-101"), loc()));
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "campusLocations", "lab-204")));
    await assertSucceeds(getDocs(collection(dbAs(WENDY), "campusLocations")));
    await assertFails(getDoc(doc(dbAnon(), "campusLocations", "lab-204")));
    await assertSucceeds(deleteDoc(doc(dbAs(ADMIN), "campusLocations", "labs-physics-lab-101")));
  });

  it("students and workers can't create, change or delete locations", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "campusLocations", "x"), loc()));
    await assertFails(setDoc(doc(dbAs(WENDY), "campusLocations", "x"), loc()));
    await assertFails(updateDoc(doc(dbAs(ALICE), "campusLocations", "lab-204"), { name: "Hacked" }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "campusLocations", "lab-204"), { name: "Renamed" }));
    await assertFails(deleteDoc(doc(dbAs(WENDY), "campusLocations", "lab-204")));
  });

  it("rejects bad ids and fields", async () => {
    await assertFails(setDoc(doc(dbAs(ADMIN), "campusLocations", "Bad Id!"), loc()));
    await assertFails(setDoc(doc(dbAs(ADMIN), "campusLocations", "ok-id"), loc({ name: "" })));
    await assertFails(setDoc(doc(dbAs(ADMIN), "campusLocations", "ok-id"), loc({ secret: "x" })));
  });
});

// ------------------------------------------------------------------
describe("SLA configuration", () => {
  const sla = (overrides: Record<string, unknown> = {}) => ({ High: 4, Medium: 24, Low: 72, updatedAt: serverTimestamp(), ...overrides });

  it("admins save it; everyone signed in reads it", async () => {
    await assertSucceeds(setDoc(doc(dbAs(ADMIN), "config", "sla"), sla()));
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "config", "sla")));
    await assertFails(getDoc(doc(dbAnon(), "config", "sla")));
  });

  it("students and workers can't change it", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "config", "sla"), sla()));
    await assertFails(setDoc(doc(dbAs(WENDY), "config", "sla"), sla({ High: 2000 })));
  });

  it.each([
    ["zero hours", { High: 0 }],
    ["fractional hours", { High: 4.5 }],
    ["more than 90 days", { Low: 2161 }],
    ["text", { Medium: "24" }],
    ["an extra field", { Critical: 1 }],
  ])("rejects %s", async (_n, overrides) => {
    await assertFails(setDoc(doc(dbAs(ADMIN), "config", "sla"), sla(overrides)));
  });

  it("no other config documents exist", async () => {
    await assertFails(setDoc(doc(dbAs(ADMIN), "config", "flags"), sla()));
    await assertFails(getDoc(doc(dbAs(ADMIN), "config", "flags")));
  });
});
