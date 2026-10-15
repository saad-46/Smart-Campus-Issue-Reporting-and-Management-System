// Security-rules tests — run against the Firestore emulator:
//
//   npm run test:rules
//
// Every case names an action a malicious client could attempt and asserts
// that the rules (not the UI) accept or reject it.

import { readFileSync } from "fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
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
  increment,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const ALICE = "alice"; // normal user
const BOB = "bob"; // another normal user
const WENDY = "wendy"; // worker
const WALT = "walt"; // another worker
const ADMIN = "admin1"; // has a document in /admins

const IMG = "data:image/png;base64,iVBORw0KGgo=";

let env: RulesTestEnvironment;

const dbAs = (uid: string) =>
  env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();
const dbAnon = () => env.unauthenticatedContext().firestore();

function profile(uid: string, role: "user" | "worker") {
  return {
    id: uid,
    name: uid,
    email: `${uid}@example.com`,
    role,
    roles: [role],
    activeRole: role,
    createdAt: new Date().toISOString(),
  };
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

type Db = ReturnType<typeof dbAnon>;

/**
 * Create an issue the way the app does: in one commit together with the
 * author's rate-limit stamp. Returns the commit promise.
 */
function createIssue(uid: string, overrides: Record<string, unknown> = {}, id = "new-issue", db: Db = dbAs(uid)) {
  const batch = writeBatch(db);
  batch.set(doc(db, "issues", id), newIssue(uid, overrides));
  batch.set(doc(db, "rateLimits", uid), { lastIssueAt: serverTimestamp() });
  return batch.commit();
}

/** Seed documents with rules bypassed. */
async function seed(fn: (db: ReturnType<typeof dbAnon>) => Promise<void>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as ReturnType<typeof dbAnon>);
  });
}

async function seedIssue(id: string, data: Record<string, unknown>) {
  await seed(async (db) => {
    await setDoc(doc(db, "issues", id), {
      ...newIssue(ALICE),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-unifix",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "users", ALICE), profile(ALICE, "user"));
    await setDoc(doc(db, "users", BOB), profile(BOB, "user"));
    await setDoc(doc(db, "users", WENDY), profile(WENDY, "worker"));
    await setDoc(doc(db, "users", WALT), profile(WALT, "worker"));
    await setDoc(doc(db, "users", ADMIN), profile(ADMIN, "user"));
    await setDoc(doc(db, "admins", ADMIN), { grantedAt: new Date() });
    await setDoc(doc(db, "finance", "budget"), { totalAvailable: 1000, totalSpent: 0, updatedAt: new Date() });
  });
});

// ------------------------------------------------------------------
describe("unauthenticated access", () => {
  it("cannot read anything", async () => {
    await seedIssue("i1", {});
    const db = dbAnon();
    await assertFails(getDoc(doc(db, "issues", "i1")));
    await assertFails(getDocs(collection(db, "issues")));
    await assertFails(getDoc(doc(db, "users", ALICE)));
    await assertFails(getDoc(doc(db, "finance", "budget")));
    await assertFails(getDocs(collection(db, "transactions")));
    await assertFails(getDoc(doc(db, "admins", ADMIN)));
  });

  it("cannot write anything", async () => {
    const db = dbAnon();
    await assertFails(addDoc(collection(db, "issues"), newIssue("ghost")));
    await assertFails(setDoc(doc(db, "users", "ghost"), profile("ghost", "user")));
    await assertFails(setDoc(doc(db, "admins", "ghost"), {}));
  });

  it("cannot touch collections the app doesn't define", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "secrets", "x"), { a: 1 }));
    await assertFails(getDoc(doc(dbAs(ADMIN), "secrets", "x")));
  });
});

// ------------------------------------------------------------------
// Viewer Mode is public and uses only static sample data. These pin down
// that a signed-out visitor still can't read or change anything private,
// whatever the client sends.
describe("public visitors (Viewer Mode)", () => {
  beforeEach(async () => {
    await seedIssue("v1", { assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending", claimDescription: "Parts" });
    await seed(async (db) => {
      await setDoc(doc(db, "issues", "v1", "receipts", "receipt"), { data: IMG, createdBy: WENDY, createdAt: new Date() });
      await setDoc(doc(db, "issues", "v1", "images", "0"), { data: IMG, index: 0, createdBy: ALICE, createdAt: new Date() });
      await setDoc(doc(db, "notifications", "n1"), { recipientId: ALICE, type: "status_changed", createdAt: new Date() });
      await setDoc(doc(db, "feedback", "v1"), { issueId: "v1", rating: 5, comment: "", createdBy: ALICE, assignedTo: WENDY, category: "General", createdAt: new Date() });
      await setDoc(doc(db, "campusLocations", "lab"), { name: "Lab", buildingId: "labs", floor: "", room: "", createdAt: new Date() });
      await setDoc(doc(db, "config", "sla"), { High: 6, Medium: 24, Low: 72 });
    });
  });

  it("cannot read receipts, photos, events, chat, notifications, feedback, locations or settings", async () => {
    const db = dbAnon();
    await assertFails(getDoc(doc(db, "issues", "v1", "receipts", "receipt")));
    await assertFails(getDoc(doc(db, "issues", "v1", "images", "0")));
    await assertFails(getDocs(collection(db, "issues", "v1", "events")));
    await assertFails(getDocs(collection(db, "issues", "v1", "messages")));
    await assertFails(getDoc(doc(db, "notifications", "n1")));
    await assertFails(getDoc(doc(db, "feedback", "v1")));
    await assertFails(getDoc(doc(db, "campusLocations", "lab")));
    await assertFails(getDoc(doc(db, "config", "sla")));
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(getDoc(doc(db, "viewer_demo", "anything"))); // no public demo collection exists
  });

  it("cannot perform any admin, worker or student operation", async () => {
    const db = dbAnon();
    const issue = doc(db, "issues", "v1");
    await assertFails(updateDoc(issue, { claimStatus: "approved" }));
    await assertFails(updateDoc(issue, { assignedTo: WALT }));
    await assertFails(updateDoc(issue, { escalated: true }));
    await assertFails(updateDoc(issue, { claimDescription: "changed" }));
    await assertFails(updateDoc(issue, { upvotes: 1, upvotedBy: ["anon"] }));
    await assertFails(deleteDoc(issue));
    await assertFails(updateDoc(doc(db, "finance", "budget"), { totalAvailable: increment(1000) }));
    await assertFails(addDoc(collection(db, "transactions"), { workerId: WENDY, amount: 450, issueId: "v1" }));
    await assertFails(setDoc(doc(db, "config", "sla"), { High: 1, Medium: 1, Low: 1 }));
    await assertFails(setDoc(doc(db, "campusLocations", "new"), { name: "x", buildingId: "", floor: "", room: "" }));
    await assertFails(setDoc(doc(db, "feedback", "v1"), { rating: 1 }));
    await assertFails(setDoc(doc(db, "viewer_demo", "x"), { a: 1 }));
  });
});

// ------------------------------------------------------------------
describe("role escalation", () => {
  it("a new account registers as a plain user, optionally requesting worker access", async () => {
    await assertSucceeds(setDoc(doc(dbAs("newbie"), "users", "newbie"), profile("newbie", "user")));
    await assertSucceeds(
      setDoc(doc(dbAs("newbie2"), "users", "newbie2"), { ...profile("newbie2", "user"), workerRequest: "pending" })
    );
  });

  it("a new account cannot register itself as a worker", async () => {
    const db = dbAs("mallory");
    await assertFails(setDoc(doc(db, "users", "mallory"), profile("mallory", "worker")));
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), activeRole: "worker" }));
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), roles: ["user", "worker"] }));
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), workerRequest: "approved" }));
  });

  it("a user cannot approve their own worker request", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users", "carl"), { ...profile("carl", "user"), workerRequest: "pending" });
    });
    const ref = doc(dbAs("carl"), "users", "carl");
    await assertFails(updateDoc(ref, { workerRequest: "approved" }));
    await assertFails(updateDoc(ref, { role: "worker", workerRequest: "approved" }));
    await assertFails(updateDoc(ref, { activeRole: "worker" }));
    // ...and gains no worker powers while pending
    await seedIssue("open1", { createdBy: ALICE });
    await assertFails(updateDoc(doc(dbAs("carl"), "issues", "open1"), { assignedTo: "carl", updatedAt: serverTimestamp() }));
  });

  it("an admin approves, rejects and revokes worker access; a worker cannot", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users", "carl"), { ...profile("carl", "user"), workerRequest: "pending" });
    });
    const approve = { role: "worker", roles: ["user", "worker"], activeRole: "worker", workerRequest: "approved" };
    await assertFails(updateDoc(doc(dbAs(WENDY), "users", "carl"), approve));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "users", "carl"), approve));
    // Once approved, the account really can do worker things.
    await seedIssue("open1", { createdBy: ALICE });
    await assertSucceeds(updateDoc(doc(dbAs("carl"), "issues", "open1"), { assignedTo: "carl", updatedAt: serverTimestamp() }));
    // Revoke.
    await assertSucceeds(
      updateDoc(doc(dbAs(ADMIN), "users", "carl"), { role: "user", roles: ["user"], activeRole: "user", workerRequest: "rejected" })
    );
    await seedIssue("open2", { createdBy: ALICE });
    await assertFails(updateDoc(doc(dbAs("carl"), "issues", "open2"), { assignedTo: "carl", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "users", "carl"), { workerRequest: "whatever" }));
  });

  it("a new account cannot register as admin", async () => {
    const db = dbAs("mallory");
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), role: "admin", roles: ["admin"], activeRole: "admin" }));
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), activeRole: "admin" }));
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), roles: ["user", "worker", "admin"] }));
  });

  it("a new account cannot smuggle extra fields into its profile", async () => {
    const db = dbAs("mallory");
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), earnings: 99999 }));
    await assertFails(setDoc(doc(db, "users", "mallory"), { ...profile("mallory", "user"), isAdmin: true }));
  });

  it("cannot create a profile for someone else or with someone else's email", async () => {
    await assertFails(setDoc(doc(dbAs("mallory"), "users", "victim"), profile("victim", "user")));
    await assertFails(setDoc(doc(dbAs("mallory"), "users", "mallory"), { ...profile("mallory", "user"), email: "admin1@example.com" }));
  });

  it("a user cannot change their own role, roles or earnings", async () => {
    const ref = doc(dbAs(ALICE), "users", ALICE);
    await assertFails(updateDoc(ref, { role: "admin" }));
    await assertFails(updateDoc(ref, { role: "worker" }));
    await assertFails(updateDoc(ref, { roles: ["user", "worker", "admin"] }));
    await assertFails(updateDoc(ref, { earnings: 1000000 }));
    await assertFails(updateDoc(ref, { isAdmin: true }));
  });

  it("a user cannot switch their active role to one they don't hold", async () => {
    const ref = doc(dbAs(ALICE), "users", ALICE);
    await assertFails(updateDoc(ref, { activeRole: "admin" }));
    await assertFails(updateDoc(ref, { activeRole: "worker" }));
    await assertSucceeds(updateDoc(ref, { activeRole: "user" }));
  });

  it("a worker can switch between user and worker, but not to admin", async () => {
    const ref = doc(dbAs(WENDY), "users", WENDY);
    await assertSucceeds(updateDoc(ref, { activeRole: "user" }));
    await assertSucceeds(updateDoc(ref, { activeRole: "worker" }));
    await assertFails(updateDoc(ref, { activeRole: "admin" }));
  });

  it("an admin can switch to any role", async () => {
    const ref = doc(dbAs(ADMIN), "users", ADMIN);
    await assertSucceeds(updateDoc(ref, { activeRole: "admin" }));
    await assertSucceeds(updateDoc(ref, { activeRole: "worker" }));
  });

  it("nobody can write the admin allow-list from a client — not even an admin", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "admins", ALICE), { grantedAt: new Date() }));
    await assertFails(setDoc(doc(dbAs(WENDY), "admins", WENDY), {}));
    await assertFails(setDoc(doc(dbAs(ADMIN), "admins", BOB), {}));
    await assertFails(updateDoc(doc(dbAs(ALICE), "admins", ADMIN), { grantedTo: ALICE }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "admins", ADMIN), { note: "edited" }));
    await assertFails(deleteDoc(doc(dbAs(ALICE), "admins", ADMIN)));
    await assertFails(deleteDoc(doc(dbAs(ADMIN), "admins", ADMIN)));
  });

  it("a legacy profile that says role 'admin' grants nothing without an admins/ document", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "users", "legacy"), {
        ...profile("legacy", "user"),
        role: "admin",
        roles: ["user", "worker", "admin"],
        activeRole: "admin",
      });
    });
    const db = dbAs("legacy");
    await assertFails(getDoc(doc(db, "finance", "budget")));
    await assertFails(getDocs(collection(db, "users")));
    await assertFails(updateDoc(doc(db, "users", ALICE), { role: "worker" }));
  });

  it("users cannot delete profiles", async () => {
    await assertFails(deleteDoc(doc(dbAs(ALICE), "users", ALICE)));
    await assertFails(deleteDoc(doc(dbAs(ADMIN), "users", ALICE)));
  });
});

// ------------------------------------------------------------------
describe("profile privacy", () => {
  it("users read their own profile but not other people's", async () => {
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "users", ALICE)));
    await assertFails(getDoc(doc(dbAs(ALICE), "users", BOB)));
    await assertFails(getDocs(collection(dbAs(ALICE), "users")));
    await assertFails(getDocs(query(collection(dbAs(WENDY), "users"), where("role", "==", "worker"))));
  });

  it("users cannot modify another user's profile", async () => {
    await assertFails(updateDoc(doc(dbAs(ALICE), "users", BOB), { name: "pwned" }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "users", BOB), { activeRole: "user" }));
  });

  it("admins can list workers and manage roles", async () => {
    await assertSucceeds(getDocs(query(collection(dbAs(ADMIN), "users"), where("role", "==", "worker"))));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "users", BOB), { role: "worker" }));
  });

  it("a user can check their own admin grant but not someone else's", async () => {
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "admins", ALICE)));
    await assertFails(getDoc(doc(dbAs(ALICE), "admins", ADMIN)));
    await assertFails(getDocs(collection(dbAs(ALICE), "admins")));
  });
});

// ------------------------------------------------------------------
describe("creating issues", () => {
  it("a signed-in user can report an issue", async () => {
    await assertSucceeds(createIssue(ALICE));
    await assertSucceeds(createIssue(BOB, { thumbnails: [IMG, IMG, IMG], imageCount: 3 }, "with-photos"));
  });

  it("an issue written without the rate-limit stamp is rejected", async () => {
    await assertFails(addDoc(collection(dbAs(ALICE), "issues"), newIssue(ALICE)));
    await assertFails(setDoc(doc(dbAs(ALICE), "issues", "direct"), newIssue(ALICE)));
  });

  it("rate limit: a second issue from the same account right away is rejected", async () => {
    await assertSucceeds(createIssue(ALICE, {}, "first"));
    await assertFails(createIssue(ALICE, {}, "second"));
    // Another account is unaffected.
    await assertSucceeds(createIssue(BOB, {}, "third"));
  });

  it("rate limit: allowed again once the cooldown has passed", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "rateLimits", ALICE), { lastIssueAt: new Date(Date.now() - 31_000) });
    });
    await assertSucceeds(createIssue(ALICE));
  });

  it("rate limit: the stamp cannot be backdated, forged or written for someone else", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "rateLimits", ALICE), { lastIssueAt: new Date() });
    });
    const db = dbAs(ALICE);
    await assertFails(setDoc(doc(db, "rateLimits", ALICE), { lastIssueAt: new Date("2020-01-01") }));
    await assertFails(deleteDoc(doc(db, "rateLimits", ALICE)));
    await assertFails(setDoc(doc(db, "rateLimits", BOB), { lastIssueAt: serverTimestamp() }));
    await assertFails(getDoc(doc(db, "rateLimits", BOB)));
    await assertSucceeds(getDoc(doc(db, "rateLimits", ALICE)));
  });

  it("cannot report an issue in someone else's name", async () => {
    await assertFails(createIssue(BOB, {}, "forged", dbAs(ALICE)));
  });

  it.each([
    ["pre-resolved", { status: "Resolved" }],
    ["pre-assigned", { assignedTo: ALICE }],
    ["pre-upvoted", { upvotes: 50 }],
    ["pre-upvoted list", { upvotedBy: ["a", "b"], upvotes: 2 }],
    ["pre-escalated", { escalated: true }],
    ["backdated", { createdAt: new Date("2020-01-01") }],
    ["with a claim", { claimAmount: 5000, claimStatus: "approved" }],
    ["unknown status", { status: "RandomInvalidState" }],
  ])("rejects an issue created %s", async (_name, overrides) => {
    await assertFails(createIssue(ALICE, overrides));
  });

  it.each([
    ["empty title", { title: "" }],
    ["non-string title", { title: 12345 }],
    ["over-long title", { title: "x".repeat(151) }],
    ["empty description", { description: "" }],
    ["over-long description", { description: "x".repeat(5001) }],
    ["empty location", { location: "" }],
    ["over-long location", { location: "x".repeat(201) }],
    ["invalid category", { category: "Hacking" }],
    ["invalid priority", { priority: "Critical" }],
    ["unexpected extra field", { isFeatured: true }],
  ])("rejects an issue with %s", async (_name, overrides) => {
    await assertFails(createIssue(ALICE, overrides));
  });

  it.each([
    ["a javascript: URL", { thumbnails: ["javascript:alert(1)"], imageCount: 1 }],
    ["a remote URL", { thumbnails: ["https://evil.example/pixel.gif"], imageCount: 1 }],
    ["an HTML data URL", { thumbnails: ["data:text/html;base64,PHNjcmlwdD4="], imageCount: 1 }],
    ["an SVG data URL", { thumbnails: ["data:image/svg+xml;base64,PHN2Zz4="], imageCount: 1 }],
    ["more than three thumbnails", { thumbnails: [IMG, IMG, IMG, IMG], imageCount: 4 }],
    ["an oversized thumbnail", { thumbnails: [`data:image/jpeg;base64,${"A".repeat(24001)}`], imageCount: 1 }],
    ["a wrong image count", { thumbnails: [IMG], imageCount: 3 }],
    ["full images stuffed into the document", { imageUrls: [IMG] }],
    ["a legacy imageUrl", { imageUrl: "https://evil.example/pixel.gif" }],
  ])("rejects an issue whose images include %s", async (_name, overrides) => {
    await assertFails(createIssue(ALICE, overrides));
  });

  it("stores markup as inert text (it is escaped on render, not rejected)", async () => {
    await assertSucceeds(createIssue(ALICE, { description: "<script>alert('XSS')</script>" }));
  });
});

// ------------------------------------------------------------------
describe("reading issues", () => {
  it("any signed-in user can read issues (community feed)", async () => {
    await seedIssue("i1", {});
    await assertSucceeds(getDoc(doc(dbAs(BOB), "issues", "i1")));
    await assertSucceeds(getDocs(query(collection(dbAs(ALICE), "issues"), where("createdBy", "==", ALICE))));
    await assertSucceeds(
      getDocs(query(collection(dbAs(WENDY), "issues"), where("status", "==", "Open"), where("assignedTo", "==", "")))
    );
  });
});

// ------------------------------------------------------------------
describe("updating issues as a normal user", () => {
  beforeEach(async () => {
    await seedIssue("mine", { createdBy: ALICE });
    await seedIssue("theirs", { createdBy: BOB });
  });

  it("cannot change the status of their own issue", async () => {
    const ref = doc(dbAs(ALICE), "issues", "mine");
    await assertFails(updateDoc(ref, { status: "Resolved" }));
    await assertFails(updateDoc(ref, { status: "In Progress" }));
  });

  it("cannot modify system-managed fields on their own issue", async () => {
    const ref = doc(dbAs(ALICE), "issues", "mine");
    await assertFails(updateDoc(ref, { createdBy: BOB }));
    await assertFails(updateDoc(ref, { createdAt: new Date("2020-01-01") }));
    await assertFails(updateDoc(ref, { assignedTo: ALICE }));
    await assertFails(updateDoc(ref, { priority: "High" }));
    await assertFails(updateDoc(ref, { escalated: true }));
    await assertFails(updateDoc(ref, { claimAmount: 9999, claimStatus: "approved" }));
    await assertFails(updateDoc(ref, { upvotes: 999 }));
  });

  it("cannot edit or delete another user's issue", async () => {
    const ref = doc(dbAs(ALICE), "issues", "theirs");
    await assertFails(updateDoc(ref, { title: "defaced" }));
    await assertFails(updateDoc(ref, { status: "Resolved" }));
    await assertFails(deleteDoc(ref));
  });

  it("cannot claim tasks or act as a worker", async () => {
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "theirs"), { assignedTo: ALICE, updatedAt: serverTimestamp() }));
  });

  it("can withdraw their own issue only while it is open and unassigned", async () => {
    await seedIssue("taken", { createdBy: ALICE, assignedTo: WENDY });
    await seedIssue("progress", { createdBy: ALICE, assignedTo: WENDY, status: "In Progress" });
    await assertFails(deleteDoc(doc(dbAs(ALICE), "issues", "taken")));
    await assertFails(deleteDoc(doc(dbAs(ALICE), "issues", "progress")));
    await assertSucceeds(deleteDoc(doc(dbAs(ALICE), "issues", "mine")));
  });
});

// ------------------------------------------------------------------
describe("upvoting", () => {
  beforeEach(async () => {
    await seedIssue("i1", { createdBy: BOB, upvotes: 1, upvotedBy: ["carol"] });
  });

  it("a user can add and remove their own upvote", async () => {
    const ref = doc(dbAs(ALICE), "issues", "i1");
    await assertSucceeds(updateDoc(ref, { upvotes: 2, upvotedBy: ["carol", ALICE] }));
    await assertSucceeds(updateDoc(ref, { upvotes: 1, upvotedBy: ["carol"] }));
  });

  it("cannot vote on someone else's behalf or remove their vote", async () => {
    const ref = doc(dbAs(ALICE), "issues", "i1");
    await assertFails(updateDoc(ref, { upvotes: 2, upvotedBy: ["carol", BOB] }));
    await assertFails(updateDoc(ref, { upvotes: 0, upvotedBy: [] }));
    await assertFails(updateDoc(ref, { upvotes: 3, upvotedBy: ["carol", ALICE, BOB] }));
  });

  it("cannot vote twice or inflate the counter", async () => {
    const ref = doc(dbAs(ALICE), "issues", "i1");
    await assertFails(updateDoc(ref, { upvotes: 3, upvotedBy: ["carol", ALICE, ALICE] }));
    await assertFails(updateDoc(ref, { upvotes: 500, upvotedBy: ["carol", ALICE] }));
    await assertFails(updateDoc(ref, { upvotes: 500 }));
  });

  it("cannot use an upvote to smuggle in other changes", async () => {
    const ref = doc(dbAs(ALICE), "issues", "i1");
    await assertFails(updateDoc(ref, { upvotes: 2, upvotedBy: ["carol", ALICE], status: "Resolved" }));
    await assertFails(updateDoc(ref, { upvotes: 2, upvotedBy: ["carol", ALICE], priority: "High" }));
  });

  it("promotes priority to High only once the threshold is reached", async () => {
    await seedIssue("hot", { createdBy: BOB, upvotes: 4, upvotedBy: ["a", "b", "c", "d"], priority: "Low" });
    const ref = doc(dbAs(ALICE), "issues", "hot");
    await assertFails(updateDoc(ref, { upvotes: 5, upvotedBy: ["a", "b", "c", "d", ALICE], priority: "Medium" }));
    await assertSucceeds(updateDoc(ref, { upvotes: 5, upvotedBy: ["a", "b", "c", "d", ALICE], priority: "High" }));
  });
});

// ------------------------------------------------------------------
describe("issue lifecycle (workers)", () => {
  beforeEach(async () => {
    await seedIssue("open", { createdBy: ALICE });
    await seedIssue("claimed", { createdBy: ALICE, assignedTo: WENDY });
    await seedIssue("working", { createdBy: ALICE, assignedTo: WENDY, status: "In Progress" });
    await seedIssue("done", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved" });
  });

  it("a worker can claim an open, unassigned issue for themselves", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(WENDY), "issues", "open"), { assignedTo: WENDY, updatedAt: serverTimestamp() }));
  });

  it("a worker cannot assign an issue to someone else or steal a claimed one", async () => {
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "open"), { assignedTo: WALT, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbAs(WALT), "issues", "claimed"), { assignedTo: WALT, updatedAt: serverTimestamp() }));
  });

  it("the assignee moves Open → In Progress → Resolved", async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(WENDY), "issues", "claimed"), {
        status: "In Progress",
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
    await assertSucceeds(
      updateDoc(doc(dbAs(WENDY), "issues", "working"), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("rejects skipped, backwards and invalid transitions", async () => {
    const stamp = { updatedAt: serverTimestamp() };
    // Open → Resolved (skipping In Progress)
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "claimed"), { status: "Resolved", resolvedAt: serverTimestamp(), ...stamp }));
    // Resolved → Open / In Progress
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "done"), { status: "Open", ...stamp }));
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "done"), { status: "In Progress", startedAt: serverTimestamp(), ...stamp }));
    // In Progress → Open
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "working"), { status: "Open", ...stamp }));
    // Nonsense
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "working"), { status: "RandomInvalidState", ...stamp }));
  });

  it("a worker cannot progress an issue assigned to someone else", async () => {
    await assertFails(
      updateDoc(doc(dbAs(WALT), "issues", "working"), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("a worker cannot backdate lifecycle timestamps", async () => {
    await assertFails(
      updateDoc(doc(dbAs(WENDY), "issues", "working"), {
        status: "Resolved",
        resolvedAt: new Date("2020-01-01"),
        updatedAt: serverTimestamp(),
      })
    );
  });

  it("a worker can attach an expense claim when resolving", async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(WENDY), "issues", "working"), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        claimAmount: 450,
        claimStatus: "pending",
        hasReceipt: false,
      })
    );
  });

  it("a worker can describe what the claim was spent on, and it persists for admins to read", async () => {
    await assertSucceeds(
      updateDoc(doc(dbAs(WENDY), "issues", "working"), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        claimAmount: 450,
        claimStatus: "pending",
        hasReceipt: false,
        claimDescription: "Replacement tap cartridge",
      })
    );
    const snap = await getDoc(doc(dbAs(ADMIN), "issues", "working"));
    expect(snap.data()?.claimDescription).toBe("Replacement tap cartridge");
    expect(snap.data()?.claimAmount).toBe(450);
  });

  it.each([
    ["without a claim", { claimDescription: "Parts" }],
    ["that is not text", { claimAmount: 450, claimStatus: "pending", claimDescription: 42 }],
    ["that is empty", { claimAmount: 450, claimStatus: "pending", claimDescription: "" }],
    ["over 500 characters", { claimAmount: 450, claimStatus: "pending", claimDescription: "x".repeat(501) }],
  ])("rejects a claim description %s", async (_name, fields) => {
    await assertFails(
      updateDoc(doc(dbAs(WENDY), "issues", "working"), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...fields,
      })
    );
  });

  it("only the assignee can file a described claim; nobody can change the description afterwards", async () => {
    const resolve = {
      status: "Resolved",
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      claimAmount: 450,
      claimStatus: "pending",
      claimDescription: "Parts",
    };
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "working"), resolve)); // a student
    await assertFails(updateDoc(doc(dbAs(WALT), "issues", "working"), resolve)); // another worker

    await seedIssue("described", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending", claimDescription: "Parts" });
    for (const uid of [WENDY, ALICE, WALT, ADMIN]) {
      await assertFails(updateDoc(doc(dbAs(uid), "issues", "described"), { claimDescription: "Something else" }));
    }
  });

  it("a worker can attach a receipt photo, but only in the commit that files the claim", async () => {
    const db = dbAs(WENDY);
    const receipt = { data: IMG, createdBy: WENDY, createdAt: serverTimestamp() };
    const resolve = {
      status: "Resolved",
      resolvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      claimAmount: 450,
      claimStatus: "pending",
      hasReceipt: true,
    };

    // Before any claim exists: rejected.
    await assertFails(setDoc(doc(db, "issues", "working", "receipts", "receipt"), receipt));

    const batch = writeBatch(db);
    batch.update(doc(db, "issues", "working"), resolve);
    batch.set(doc(db, "issues", "working", "receipts", "receipt"), receipt);
    await assertSucceeds(batch.commit());

    // Afterwards it can't be replaced or added to.
    await assertFails(setDoc(doc(db, "issues", "working", "receipts", "receipt"), receipt));
    await assertFails(setDoc(doc(db, "issues", "working", "receipts", "second"), receipt));
    await assertFails(deleteDoc(doc(db, "issues", "working", "receipts", "receipt")));
  });

  it("a receipt must be a valid inline image from the assignee", async () => {
    const attempt = (uid: string, receipt: Record<string, unknown>) => {
      const db = dbAs(uid);
      const batch = writeBatch(db);
      batch.update(doc(db, "issues", "working"), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        claimAmount: 450,
        claimStatus: "pending",
        hasReceipt: true,
      });
      batch.set(doc(db, "issues", "working", "receipts", "receipt"), receipt);
      return batch.commit();
    };
    await assertFails(attempt(WENDY, { data: "javascript:alert(1)", createdBy: WENDY, createdAt: serverTimestamp() }));
    await assertFails(attempt(WENDY, { data: `data:image/jpeg;base64,${"A".repeat(250001)}`, createdBy: WENDY, createdAt: serverTimestamp() }));
    await assertFails(attempt(WENDY, { data: IMG, createdBy: WALT, createdAt: serverTimestamp() }));
    await assertFails(attempt(WALT, { data: IMG, createdBy: WALT, createdAt: serverTimestamp() }));
  });

  it("a receipt is readable only by the assigned worker and admins", async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "issues", "done", "receipts", "receipt"), { data: IMG, createdBy: WENDY, createdAt: new Date() });
    });
    const path = ["issues", "done", "receipts", "receipt"] as const;
    await assertSucceeds(getDoc(doc(dbAs(WENDY), ...path)));
    await assertSucceeds(getDoc(doc(dbAs(ADMIN), ...path)));
    await assertFails(getDoc(doc(dbAs(ALICE), ...path))); // the issue's own author
    await assertFails(getDoc(doc(dbAs(WALT), ...path))); // another worker
    await assertFails(getDocs(collection(dbAs(WENDY), "issues", "done", "receipts")));
  });

  it.each([
    ["self-approved", { claimAmount: 450, claimStatus: "approved" }],
    ["negative", { claimAmount: -10, claimStatus: "pending" }],
    ["absurdly large", { claimAmount: 99999999, claimStatus: "pending" }],
    ["non-numeric", { claimAmount: "450", claimStatus: "pending" }],
    ["with a javascript: receipt link", { claimAmount: 450, claimStatus: "pending", receiptUrl: "javascript:alert(1)" }],
    ["with an inline receipt on the public issue", { claimAmount: 450, claimStatus: "pending", receiptUrl: IMG }],
  ])("rejects a %s claim", async (_name, claim) => {
    await assertFails(
      updateDoc(doc(dbAs(WENDY), "issues", "working"), {
        status: "Resolved",
        resolvedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...claim,
      })
    );
  });

  it("a worker cannot approve their own claim afterwards", async () => {
    await seedIssue("claim", { assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "claim"), { claimStatus: "approved" }));
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "claim"), { claimAmount: 45000 }));
  });

  it("a worker cannot rewrite the report or delete it", async () => {
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "claimed"), { title: "changed" }));
    await assertFails(updateDoc(doc(dbAs(WENDY), "issues", "claimed"), { createdBy: WENDY }));
    await assertFails(deleteDoc(doc(dbAs(WENDY), "issues", "claimed")));
  });
});

// ------------------------------------------------------------------
describe("admin operations on issues", () => {
  beforeEach(async () => {
    await seedIssue("open", { createdBy: ALICE });
    await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });
  });

  it("can manage workflow fields", async () => {
    const ref = doc(dbAs(ADMIN), "issues", "open");
    await assertSucceeds(updateDoc(ref, { assignedTo: WENDY, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { priority: "High" }));
    await assertSucceeds(updateDoc(ref, { escalated: true }));
    await assertSucceeds(updateDoc(ref, { status: "In Progress", startedAt: serverTimestamp() }));
  });

  it("cannot move an issue backwards or to an invalid status", async () => {
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "claim"), { status: "Open" }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "open"), { status: "Resolved" }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "open"), { status: "RandomInvalidState" }));
  });

  it("cannot rewrite the report itself", async () => {
    const ref = doc(dbAs(ADMIN), "issues", "open");
    await assertFails(updateDoc(ref, { title: "changed" }));
    await assertFails(updateDoc(ref, { createdBy: ADMIN }));
    await assertFails(updateDoc(ref, { createdAt: new Date("2020-01-01") }));
  });

  it("can approve or reject a pending claim, once", async () => {
    const ref = doc(dbAs(ADMIN), "issues", "claim");
    await assertSucceeds(updateDoc(ref, { claimStatus: "rejected", updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { claimStatus: "approved" }));
    await assertFails(updateDoc(ref, { claimStatus: "pending" }));
  });

  it("can delete any issue", async () => {
    await assertSucceeds(deleteDoc(doc(dbAs(ADMIN), "issues", "claim")));
  });
});

// ------------------------------------------------------------------
describe("issue discussion thread", () => {
  const message = (uid: string, authorRole: string, overrides: Record<string, unknown> = {}) => ({
    text: "On my way",
    authorId: uid,
    authorName: uid,
    authorRole,
    createdAt: serverTimestamp(),
    ...overrides,
  });

  beforeEach(async () => {
    await seedIssue("i1", { createdBy: ALICE, assignedTo: WENDY, status: "In Progress" });
    await seed(async (db) => {
      await setDoc(doc(db, "issues", "i1", "messages", "m1"), {
        text: "hello",
        authorId: ALICE,
        authorName: ALICE,
        authorRole: "user",
        createdAt: new Date(),
      });
    });
  });

  it("the reporter, the assigned worker and admins can read and post", async () => {
    for (const [uid, role] of [[ALICE, "user"], [WENDY, "worker"], [ADMIN, "admin"]] as const) {
      await assertSucceeds(getDocs(collection(dbAs(uid), "issues", "i1", "messages")));
      await assertSucceeds(addDoc(collection(dbAs(uid), "issues", "i1", "messages"), message(uid, role)));
    }
  });

  it("a worker who is not assigned to the issue cannot read or post", async () => {
    await assertFails(getDocs(collection(dbAs(WALT), "issues", "i1", "messages")));
    await assertFails(getDoc(doc(dbAs(WALT), "issues", "i1", "messages", "m1")));
    await assertFails(addDoc(collection(dbAs(WALT), "issues", "i1", "messages"), message(WALT, "worker")));
  });

  it("before anyone takes the issue only the reporter and admins have the thread", async () => {
    await seedIssue("open1", { createdBy: ALICE, assignedTo: "", status: "Open" });
    await assertSucceeds(addDoc(collection(dbAs(ALICE), "issues", "open1", "messages"), message(ALICE, "user")));
    await assertFails(getDocs(collection(dbAs(WENDY), "issues", "open1", "messages")));
    await assertFails(addDoc(collection(dbAs(WENDY), "issues", "open1", "messages"), message(WENDY, "worker")));
    await assertFails(getDocs(collection(dbAs(BOB), "issues", "open1", "messages")));
  });

  it("a reassigned issue thread follows the new worker, and the previous worker loses access", async () => {
    await assertSucceeds(addDoc(collection(dbAs(WENDY), "issues", "i1", "messages"), message(WENDY, "worker")));
    await seedIssue("i1", { createdBy: ALICE, assignedTo: WALT, status: "In Progress" });
    await assertFails(getDocs(collection(dbAs(WENDY), "issues", "i1", "messages")));
    await assertFails(addDoc(collection(dbAs(WENDY), "issues", "i1", "messages"), message(WENDY, "worker")));
    await assertSucceeds(getDocs(collection(dbAs(WALT), "issues", "i1", "messages")));
    await assertSucceeds(addDoc(collection(dbAs(WALT), "issues", "i1", "messages"), message(WALT, "worker")));
    // The reporter keeps the whole history.
    await assertSucceeds(getDocs(collection(dbAs(ALICE), "issues", "i1", "messages")));
  });

  it("a worker cannot post as the reporter, and a user cannot use a worker badge", async () => {
    await assertFails(addDoc(collection(dbAs(WENDY), "issues", "i1", "messages"), message(ALICE, "user")));
    await assertFails(addDoc(collection(dbAs(ALICE), "issues", "i1", "messages"), message(ALICE, "worker")));
  });

  it("an unrelated user cannot read or post", async () => {
    await assertFails(getDocs(collection(dbAs(BOB), "issues", "i1", "messages")));
    await assertFails(getDoc(doc(dbAs(BOB), "issues", "i1", "messages", "m1")));
    await assertFails(addDoc(collection(dbAs(BOB), "issues", "i1", "messages"), message(BOB, "user")));
  });

  it("cannot impersonate another author or fake a staff badge", async () => {
    const col = collection(dbAs(ALICE), "issues", "i1", "messages");
    await assertFails(addDoc(col, message(BOB, "user")));
    await assertFails(addDoc(col, message(ALICE, "admin")));
    await assertFails(addDoc(col, message(ALICE, "worker")));
    await assertFails(addDoc(collection(dbAs(WENDY), "issues", "i1", "messages"), message(WENDY, "admin")));
  });

  it("rejects empty, over-long, backdated or padded messages", async () => {
    const col = collection(dbAs(ALICE), "issues", "i1", "messages");
    await assertFails(addDoc(col, message(ALICE, "user", { text: "" })));
    await assertFails(addDoc(col, message(ALICE, "user", { text: "x".repeat(2001) })));
    await assertFails(addDoc(col, message(ALICE, "user", { createdAt: new Date("2020-01-01") })));
    await assertFails(addDoc(col, message(ALICE, "user", { pinned: true })));
  });

  it("messages are immutable", async () => {
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "i1", "messages", "m1"), { text: "edited" }));
    await assertFails(deleteDoc(doc(dbAs(ALICE), "issues", "i1", "messages", "m1")));
    await assertFails(deleteDoc(doc(dbAs(ADMIN), "issues", "i1", "messages", "m1")));
  });
});

// ------------------------------------------------------------------
describe("conversation summaries (conversations/{issueId})", () => {
  const first = (uid: string, overrides: Record<string, unknown> = {}) => ({
    issueId: "c1",
    studentId: ALICE,
    workerId: WENDY,
    participants: [ALICE, WENDY],
    createdAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    lastSenderId: uid,
    lastPreview: "On my way",
    readAt: { [uid]: serverTimestamp() },
    ...overrides,
  });

  beforeEach(async () => {
    await seedIssue("c1", { createdBy: ALICE, assignedTo: WENDY, status: "In Progress" });
    await seedIssue("c0", { createdBy: ALICE, assignedTo: "", status: "Open" });
  });

  const stored = async (extra: Record<string, unknown> = {}) =>
    seed(async (db) => {
      await setDoc(doc(db, "conversations", "c1"), {
        issueId: "c1",
        studentId: ALICE,
        workerId: WENDY,
        participants: [ALICE, WENDY],
        createdAt: new Date(),
        lastMessageAt: new Date(Date.now() - 60_000),
        lastSenderId: ALICE,
        lastPreview: "hello",
        readAt: { [ALICE]: new Date(Date.now() - 60_000) },
        ...extra,
      });
    });

  it("the assigned worker creates it with the first message; participants come from the issue", async () => {
    await assertSucceeds(setDoc(doc(dbAs(WENDY), "conversations", "c1"), first(WENDY)));
  });

  it("the reporter can create it too", async () => {
    await assertSucceeds(setDoc(doc(dbAs(ALICE), "conversations", "c1"), first(ALICE)));
  });

  it("nobody else can create it, and it cannot name other participants", async () => {
    await assertFails(setDoc(doc(dbAs(BOB), "conversations", "c1"), first(BOB)));
    await assertFails(setDoc(doc(dbAs(WALT), "conversations", "c1"), first(WALT, { workerId: WALT, participants: [ALICE, WALT] })));
    await assertFails(setDoc(doc(dbAs(WENDY), "conversations", "c1"), first(WENDY, { studentId: BOB, participants: [BOB, WENDY] })));
    await assertFails(setDoc(doc(dbAs(WENDY), "conversations", "c1"), first(ALICE)));
  });

  it("cannot exist for an issue nobody has taken", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "conversations", "c0"), first(ALICE, { issueId: "c0", workerId: "", participants: [ALICE, ""] })));
  });

  it("participants and admins read it; others do not", async () => {
    await stored();
    for (const uid of [ALICE, WENDY, ADMIN]) await assertSucceeds(getDoc(doc(dbAs(uid), "conversations", "c1")));
    for (const uid of [BOB, WALT]) await assertFails(getDoc(doc(dbAs(uid), "conversations", "c1")));
  });

  it("a participant can ask for the summary before it exists; others cannot", async () => {
    await assertSucceeds(getDoc(doc(dbAs(ALICE), "conversations", "c1")));
    await assertSucceeds(getDoc(doc(dbAs(WENDY), "conversations", "c1")));
    await assertFails(getDoc(doc(dbAs(BOB), "conversations", "c1")));
    await assertFails(getDoc(doc(dbAs(WALT), "conversations", "c1")));
    await assertFails(getDoc(doc(dbAs(BOB), "conversations", "does-not-exist")));
  });

  it("each user can list only their own conversations", async () => {
    await stored();
    const mine = query(collection(dbAs(ALICE), "conversations"), where("participants", "array-contains", ALICE));
    await assertSucceeds(getDocs(mine));
    const theirs = query(collection(dbAs(BOB), "conversations"), where("participants", "array-contains", ALICE));
    await assertFails(getDocs(theirs));
  });

  it("sending updates the summary; a participant marks only their own read marker", async () => {
    await stored();
    await assertSucceeds(
      updateDoc(doc(dbAs(WENDY), "conversations", "c1"), {
        lastMessageAt: serverTimestamp(),
        lastSenderId: WENDY,
        lastPreview: "Arriving now",
        workerId: WENDY,
        participants: [ALICE, WENDY],
        readAt: { [ALICE]: new Date(Date.now() - 60_000), [WENDY]: serverTimestamp() },
      })
    );
    await assertSucceeds(updateDoc(doc(dbAs(ALICE), "conversations", "c1"), { [`readAt.${ALICE}`]: serverTimestamp() }));
  });

  it("a participant cannot mark the other person read marker, backdate, or rewrite the summary", async () => {
    await stored();
    await assertFails(updateDoc(doc(dbAs(WENDY), "conversations", "c1"), { [`readAt.${ALICE}`]: serverTimestamp() }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "conversations", "c1"), { [`readAt.${ALICE}`]: new Date("2020-01-01") }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "conversations", "c1"), { lastPreview: "forged", lastSenderId: WENDY }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "conversations", "c1"), { studentId: BOB }));
  });

  it("a worker who is not assigned cannot update it, and it cannot be deleted", async () => {
    await stored();
    await assertFails(updateDoc(doc(dbAs(WALT), "conversations", "c1"), { [`readAt.${WALT}`]: serverTimestamp() }));
    await assertFails(deleteDoc(doc(dbAs(ALICE), "conversations", "c1")));
    await assertFails(deleteDoc(doc(dbAs(ADMIN), "conversations", "c1")));
  });

  it("after reassignment the new worker first message replaces the previous worker in the summary", async () => {
    await stored();
    await seedIssue("c1", { createdBy: ALICE, assignedTo: WALT, status: "In Progress" });
    await assertFails(updateDoc(doc(dbAs(WENDY), "conversations", "c1"), { [`readAt.${WENDY}`]: serverTimestamp() }));
    await assertSucceeds(
      updateDoc(doc(dbAs(WALT), "conversations", "c1"), {
        lastMessageAt: serverTimestamp(),
        lastSenderId: WALT,
        lastPreview: "I have taken over",
        workerId: WALT,
        participants: [ALICE, WALT],
        readAt: { [ALICE]: new Date(Date.now() - 60_000), [WALT]: serverTimestamp() },
      })
    );
    await assertFails(getDoc(doc(dbAs(WENDY), "conversations", "c1")));
  });
});

// ------------------------------------------------------------------
describe("finance", () => {
  const tx = (overrides: Record<string, unknown> = {}) => ({
    workerId: WENDY,
    workerName: "wendy",
    amount: 450,
    type: "receipt",
    note: "Receipt resolved for Broken light",
    issueId: "claim",
    receiptUrl: "",
    status: "approved",
    createdAt: serverTimestamp(),
    ...overrides,
  });

  beforeEach(async () => {
    await seed(async (db) => {
      await setDoc(doc(db, "transactions", "t1"), { ...tx(), createdAt: new Date() });
      await setDoc(doc(db, "transactions", "t2"), { ...tx({ workerId: WALT }), createdAt: new Date() });
    });
  });

  it("only admins can read or change the budget", async () => {
    for (const uid of [ALICE, WENDY]) {
      await assertFails(getDoc(doc(dbAs(uid), "finance", "budget")));
      await assertFails(updateDoc(doc(dbAs(uid), "finance", "budget"), { totalAvailable: increment(1000000) }));
      await assertFails(setDoc(doc(dbAs(uid), "finance", "budget"), { totalAvailable: 1, totalSpent: 0 }));
    }
    await assertSucceeds(getDoc(doc(dbAs(ADMIN), "finance", "budget")));
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "finance", "budget"), { totalAvailable: increment(500), updatedAt: serverTimestamp() }));
  });

  it("spending can never exceed the available budget", async () => {
    const ref = doc(dbAs(ADMIN), "finance", "budget");
    await assertSucceeds(updateDoc(ref, { totalSpent: increment(1000) }));
    await assertFails(updateDoc(ref, { totalSpent: increment(1) }));
    await assertFails(updateDoc(ref, { totalAvailable: -5 }));
    await assertFails(deleteDoc(ref));
  });

  it("workers see only their own payouts; users see none", async () => {
    await assertSucceeds(getDocs(query(collection(dbAs(WENDY), "transactions"), where("workerId", "==", WENDY))));
    await assertFails(getDocs(query(collection(dbAs(WENDY), "transactions"), where("workerId", "==", WALT))));
    await assertFails(getDocs(collection(dbAs(WENDY), "transactions")));
    await assertFails(getDoc(doc(dbAs(ALICE), "transactions", "t1")));
    await assertSucceeds(getDocs(collection(dbAs(ADMIN), "transactions")));
  });

  it("only admins can record payments, and the ledger is immutable", async () => {
    await assertFails(addDoc(collection(dbAs(WENDY), "transactions"), tx()));
    await assertFails(addDoc(collection(dbAs(ALICE), "transactions"), tx({ workerId: ALICE })));
    // Even an admin can't write a ledger entry that doesn't settle a pending claim.
    await assertFails(addDoc(collection(dbAs(ADMIN), "transactions"), tx()));
    await assertFails(addDoc(collection(dbAs(ADMIN), "transactions"), tx({ amount: -100 })));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "transactions", "t1"), { amount: 1 }));
    await assertFails(deleteDoc(doc(dbAs(ADMIN), "transactions", "t1")));
  });

  it("a worker cannot credit their own earnings", async () => {
    await assertFails(updateDoc(doc(dbAs(WENDY), "users", WENDY), { earnings: increment(5000) }));
  });

  it("an admin can pay out a claim atomically (the app's approveClaim batch)", async () => {
    await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });
    const db = dbAs(ADMIN);
    const batch = writeBatch(db);
    batch.update(doc(db, "finance", "budget"), { totalSpent: increment(450), updatedAt: serverTimestamp() });
    batch.update(doc(db, "users", WENDY), { earnings: increment(450) });
    batch.set(doc(collection(db, "transactions")), tx());
    batch.update(doc(db, "issues", "claim"), { claimStatus: "approved", updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  const pay = (overrides: Record<string, unknown> = {}, approveIssue = true) => {
    const db = dbAs(ADMIN);
    const batch = writeBatch(db);
    batch.update(doc(db, "finance", "budget"), { totalSpent: increment(450), updatedAt: serverTimestamp() });
    batch.update(doc(db, "users", WENDY), { earnings: increment(450) });
    batch.set(doc(collection(db, "transactions")), tx(overrides));
    if (approveIssue) batch.update(doc(db, "issues", "claim"), { claimStatus: "approved", updatedAt: serverTimestamp() });
    return batch.commit();
  };

  it("a claim can be paid exactly once", async () => {
    await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });
    await assertSucceeds(pay());
    // Second attempt, in every shape a client could try:
    await assertFails(pay()); // approved → approved again
    await assertFails(pay({}, false)); // ledger entry alone
    await assertFails(addDoc(collection(dbAs(ADMIN), "transactions"), tx()));
  });

  it("a paid claim's amount, payee and description cannot be rewritten", async () => {
    await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending", claimDescription: "Parts" });
    await assertSucceeds(pay({ note: "Broken light — Parts" }));
    for (const uid of [WENDY, ALICE, ADMIN]) {
      const ref = doc(dbAs(uid), "issues", "claim");
      await assertFails(updateDoc(ref, { claimDescription: "Laptop for me" }));
      await assertFails(updateDoc(ref, { claimAmount: 45000 }));
      await assertFails(updateDoc(ref, { claimStatus: "pending" }));
    }
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "claim"), { assignedTo: WALT }));
  });

  it("a rejected claim cannot be paid", async () => {
    await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "rejected" });
    await assertFails(pay());
  });

  describe("how a payment was made (recorded by the administrator)", () => {
    const details = { method: "bank_transfer", reference: "UTR123456", paidOn: "2026-10-10", verification: "manual", recordedBy: ADMIN };
    const claim = () => seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });

    it("accepts a complete record, and still accepts entries without these fields", async () => {
      await claim();
      await assertSucceeds(pay(details));
    });

    it("accepts cash with no reference", async () => {
      await claim();
      await assertSucceeds(pay({ method: "cash", paidOn: "2026-10-10", verification: "manual", recordedBy: ADMIN }));
    });

    it.each([
      ["an unknown method", { method: "bitcoin" }],
      ["a bank transfer with no reference", { reference: "" }],
      ["a malformed date", { paidOn: "10/10/2026" }],
      ["a claim of external verification", { verification: "bank-confirmed" }],
      ["a different administrator named as the recorder", { recordedBy: WENDY }],
      ["an over-long reference", { reference: "x".repeat(61) }],
      ["a partial record", { reference: undefined, paidOn: undefined }],
    ])("rejects %s", async (_name, overrides) => {
      await claim();
      const merged: Record<string, unknown> = { ...details, ...overrides };
      for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
      await assertFails(pay(merged));
    });

    it("rejects fields the payment record does not define", async () => {
      await claim();
      await assertFails(pay({ ...details, bankConfirmed: true }));
    });
  });

  it.each([
    ["a different amount", { amount: 4500 }],
    ["a different payee", { workerId: WALT }],
    ["an untracked 'direct' payment", { type: "direct" }],
    ["a different issue", { issueId: "does-not-exist" }],
  ])("a payment for %s than the claim is rejected", async (_name, overrides) => {
    await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });
    await assertFails(pay(overrides));
  });
});

// ------------------------------------------------------------------
describe("funds ledger (ledger/{id}) and its head (ledgerHead/state)", () => {
  const entry = (overrides: Record<string, unknown> = {}) => ({
    type: "funds_added",
    amount: 5000,
    source: "management_allocation",
    reference: "Sanction 14",
    description: "Q3 maintenance allocation",
    receivedOn: "2026-10-01",
    createdBy: ADMIN,
    createdAt: serverTimestamp(),
    ...overrides,
  });
  const headDoc = (id: string, count: number, overrides: Record<string, unknown> = {}) => ({
    lastEntryId: id,
    entryCount: count,
    updatedAt: serverTimestamp(),
    ...overrides,
  });
  const headCount = async () => (await getDoc(doc(dbAs(ADMIN), "ledgerHead", "state"))).data()?.entryCount ?? 0;

  interface AddOptions {
    raiseBy?: number;
    uid?: string;
    head?: Record<string, unknown>;
    skipHead?: boolean;
    skipBudget?: boolean;
    count?: number;
  }
  /** The app's addFundsToBudget commit as a batch: budget raise, entry, head. */
  const add = async (overrides: Record<string, unknown> = {}, o: AddOptions = {}) => {
    const db = dbAs(o.uid ?? ADMIN);
    const ref = doc(collection(db, "ledger"));
    const count = o.count ?? (await headCount());
    const batch = writeBatch(db);
    if (!o.skipBudget) batch.update(doc(db, "finance", "budget"), { totalAvailable: increment(o.raiseBy ?? 5000), updatedAt: serverTimestamp() });
    batch.set(ref, entry(overrides));
    if (!o.skipHead) batch.set(doc(db, "ledgerHead", "state"), headDoc(ref.id, count + 1, o.head));
    return batch.commit();
  };

  /** The same steps as lib/finance.ts addFundsToBudget, as a transaction (so concurrency and retries are real). */
  const addTx = (entryId: string, amount = 5000, uid = ADMIN) => {
    const db = dbAs(uid);
    const budgetRef = doc(db, "finance", "budget");
    const headRef = doc(db, "ledgerHead", "state");
    const entryRef = doc(db, "ledger", entryId);
    return runTransaction(db, async (tx) => {
      const [, headSnap, entrySnap] = await Promise.all([tx.get(budgetRef), tx.get(headRef), tx.get(entryRef)]);
      if (entrySnap.exists()) return;
      const count = headSnap.exists() ? (headSnap.data()!.entryCount as number) : 0;
      tx.update(budgetRef, { totalAvailable: increment(amount), updatedAt: serverTimestamp() });
      tx.set(entryRef, entry({ amount }));
      const next = headDoc(entryId, count + 1);
      if (headSnap.exists()) tx.update(headRef, next);
      else tx.set(headRef, next);
    });
  };

  const state = async () => {
    const db = dbAs(ADMIN);
    const budget = (await getDoc(doc(db, "finance", "budget"))).data()!;
    const entries = (await getDocs(collection(db, "ledger"))).size;
    return { available: budget.totalAvailable as number, entries, head: await headCount(), budgetKeys: Object.keys(budget).sort() };
  };

  describe("successful additions", () => {
    it("the first addition creates the head with count 1; later ones raise it by one", async () => {
      await assertSucceeds(add());
      expect(await state()).toMatchObject({ available: 6000, entries: 1, head: 1 });
      await assertSucceeds(add({ reference: "Sanction 15" }, { raiseBy: 5000 }));
      expect(await state()).toMatchObject({ available: 11_000, entries: 2, head: 2 });
    });

    it("leaves the budget document with its original keys", async () => {
      await add();
      expect((await state()).budgetKeys).toEqual(["totalAvailable", "totalSpent", "updatedAt"]);
    });

    it("works with a budget document written before the ledger existed", async () => {
      await seed(async (db) => {
        await setDoc(doc(db, "finance", "budget"), { totalAvailable: 500_000, totalSpent: 12_000 }); // no updatedAt, as the oldest records
      });
      await assertSucceeds(add());
      expect(await state()).toMatchObject({ available: 505_000, entries: 1, head: 1 });
    });

    it("payments still work after funds were added, and do not touch the ledger or its head", async () => {
      await add();
      await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });
      const db = dbAs(ADMIN);
      const batch = writeBatch(db);
      batch.update(doc(db, "finance", "budget"), { totalSpent: increment(450), updatedAt: serverTimestamp() });
      batch.update(doc(db, "users", WENDY), { earnings: increment(450) });
      batch.set(doc(collection(db, "transactions")), {
        workerId: WENDY,
        workerName: "wendy",
        amount: 450,
        type: "receipt",
        note: "Receipt resolved for Broken light",
        issueId: "claim",
        receiptUrl: "",
        status: "approved",
        method: "cash",
        paidOn: "2026-10-10",
        verification: "manual",
        recordedBy: ADMIN,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, "issues", "claim"), { claimStatus: "approved", updatedAt: serverTimestamp() });
      await assertSucceeds(batch.commit());
      expect(await state()).toMatchObject({ entries: 1, head: 1 });
    });
  });

  describe("an entry and its head must be written together", () => {
    it("an entry on its own is rejected", async () => {
      await assertFails(add({}, { skipHead: true }));
      await assertFails(addDoc(collection(dbAs(ADMIN), "ledger"), entry()));
    });

    it("a head on its own is rejected, whether it names a new id or an existing entry", async () => {
      await add();
      const existing = (await getDocs(collection(dbAs(ADMIN), "ledger"))).docs[0].id;
      await assertFails(setDoc(doc(dbAs(ADMIN), "ledgerHead", "state"), headDoc("brand-new-id", 2)));
      await assertFails(setDoc(doc(dbAs(ADMIN), "ledgerHead", "state"), headDoc(existing, 2)));
    });

    it("an entry without the budget raising by exactly its amount is rejected", async () => {
      await assertFails(add({}, { skipBudget: true }));
      await assertFails(add({}, { raiseBy: 4000 }));
      await assertFails(add({}, { raiseBy: 6000 }));
    });

    it("an addition cannot also move the spent total (an entry cannot launder a payment)", async () => {
      const db = dbAs(ADMIN);
      const ref = doc(collection(db, "ledger"));
      const batch = writeBatch(db);
      batch.update(doc(db, "finance", "budget"), { totalAvailable: increment(5000), totalSpent: increment(100), updatedAt: serverTimestamp() });
      batch.set(ref, entry());
      batch.set(doc(db, "ledgerHead", "state"), headDoc(ref.id, 1));
      await assertFails(batch.commit());
    });

    it("one budget increase cannot back two entries", async () => {
      const db = dbAs(ADMIN);
      const first = doc(collection(db, "ledger"));
      const second = doc(collection(db, "ledger"));
      const batch = writeBatch(db);
      batch.update(doc(db, "finance", "budget"), { totalAvailable: increment(5000), updatedAt: serverTimestamp() });
      batch.set(first, entry());
      batch.set(second, entry({ reference: "duplicate" }));
      batch.set(doc(db, "ledgerHead", "state"), headDoc(first.id, 1));
      await assertFails(batch.commit());
      expect(await state()).toMatchObject({ available: 1000, entries: 0, head: 0 });
    });

    it("two entries in one commit are rejected even when each is paired with its own budget raise", async () => {
      const db = dbAs(ADMIN);
      const a = doc(collection(db, "ledger"));
      const b = doc(collection(db, "ledger"));
      const batch = writeBatch(db);
      batch.update(doc(db, "finance", "budget"), { totalAvailable: increment(10_000), updatedAt: serverTimestamp() });
      batch.set(a, entry());
      batch.set(b, entry());
      batch.set(doc(db, "ledgerHead", "state"), headDoc(b.id, 1));
      await assertFails(batch.commit());
    });
  });

  describe("missing or invalid head state", () => {
    it.each([
      ["a count that skips ahead", { entryCount: 5 }],
      ["a count that does not move", { entryCount: 1 }],
      ["a count that goes backwards", { entryCount: 0 }],
      ["a fractional count", { entryCount: 1.5 }],
      ["a string count", { entryCount: "2" }],
      ["an extra field", { verified: true }],
      ["a backdated timestamp", { updatedAt: new Date("2020-01-01") }],
    ])("rejects %s on the second addition", async (_name, head) => {
      await add();
      await assertFails(add({}, { head: head as Record<string, unknown> }));
    });

    it("rejects a first head whose count is not 1", async () => {
      await assertFails(add({}, { head: { entryCount: 3 } }));
    });

    it("rejects a head with an empty or over-long entry id", async () => {
      const db = dbAs(ADMIN);
      for (const id of ["", "x".repeat(41)]) {
        const ref = doc(collection(db, "ledger"));
        const batch = writeBatch(db);
        batch.update(doc(db, "finance", "budget"), { totalAvailable: increment(5000), updatedAt: serverTimestamp() });
        batch.set(ref, entry());
        batch.set(doc(db, "ledgerHead", "state"), headDoc(id, 1));
        await assertFails(batch.commit());
      }
    });

    it("only the document id `state` exists", async () => {
      const db = dbAs(ADMIN);
      const ref = doc(collection(db, "ledger"));
      const batch = writeBatch(db);
      batch.update(doc(db, "finance", "budget"), { totalAvailable: increment(5000), updatedAt: serverTimestamp() });
      batch.set(ref, entry());
      batch.set(doc(db, "ledgerHead", "other"), headDoc(ref.id, 1));
      await assertFails(batch.commit());
    });

    it("a head that is deleted cannot be silently recreated at count 1 on top of existing entries... only an admin console action could", async () => {
      await add();
      await assertFails(deleteDoc(doc(dbAs(ADMIN), "ledgerHead", "state")));
    });
  });

  describe("entry fields", () => {
    it.each([
      ["a zero amount", { amount: 0 }],
      ["a negative amount", { amount: -5 }],
      ["a non-numeric amount", { amount: "5000" }],
      ["an absurd amount", { amount: 1_000_000_000 }],
      ["an unknown source", { source: "found on the road" }],
      ["no reason", { description: "" }],
      ["a malformed date", { receivedOn: "yesterday" }],
      ["another administrator named as the recorder", { createdBy: WENDY }],
      ["a backdated timestamp", { createdAt: new Date("2020-01-01") }],
      ["an entry of another type", { type: "payment" }],
      ["an extra field", { verified: true }],
    ] as [string, Record<string, unknown>][])("rejects %s", async (_name, overrides) => {
      // The budget is raised by exactly the stated amount and the head is
      // correct, so the field under test is what makes it fail.
      await assertFails(add(overrides, { raiseBy: typeof overrides.amount === "number" ? overrides.amount : 5000 }));
    });
  });

  describe("authorization", () => {
    it("only administrators can add entries or read the ledger and head", async () => {
      await add();
      for (const uid of [ALICE, WENDY]) {
        await assertFails(add({ createdBy: uid }, { uid }));
        await assertFails(getDocs(collection(dbAs(uid), "ledger")));
        await assertFails(getDoc(doc(dbAs(uid), "ledgerHead", "state")));
        await assertFails(setDoc(doc(dbAs(uid), "ledgerHead", "state"), headDoc("x", 9)));
      }
      await assertFails(getDocs(collection(dbAnon(), "ledger")));
      await assertFails(getDoc(doc(dbAnon(), "ledgerHead", "state")));
    });

    it("entries and the head are immutable and cannot be deleted by anyone", async () => {
      await add();
      const id = (await getDocs(collection(dbAs(ADMIN), "ledger"))).docs[0].id;
      await assertFails(updateDoc(doc(dbAs(ADMIN), "ledger", id), { amount: 1 }));
      await assertFails(deleteDoc(doc(dbAs(ADMIN), "ledger", id)));
      await assertFails(deleteDoc(doc(dbAs(WENDY), "ledger", id)));
      await assertFails(updateDoc(doc(dbAs(ADMIN), "ledgerHead", "state"), { entryCount: 99 }));
      await assertFails(deleteDoc(doc(dbAs(ADMIN), "ledgerHead", "state")));
    });

    it("a new field can no longer be added to the budget document (its schema is unchanged)", async () => {
      await assertFails(updateDoc(doc(dbAs(ADMIN), "finance", "budget"), { lastLedgerEntryId: "abc", updatedAt: serverTimestamp() }));
    });
  });

  describe("concurrency and retries (the app's transaction)", () => {
    it("two different additions at once both land, with count 2 and the budget raised by both", async () => {
      await Promise.all([assertSucceeds(addTx("entryAAA", 5000)), assertSucceeds(addTx("entryBBB", 2500))]);
      expect(await state()).toMatchObject({ available: 1000 + 7500, entries: 2, head: 2 });
    });

    it("the same entry submitted twice, one after the other, is recorded once", async () => {
      await assertSucceeds(addTx("entryRetry", 5000));
      await assertSucceeds(addTx("entryRetry", 5000));
      expect(await state()).toMatchObject({ available: 6000, entries: 1, head: 1 });
    });

    it("the same entry submitted twice at once is recorded once", async () => {
      // The loser's commit meets an existing entry and is refused by the rules
      // (the app then sees the entry and treats it as already recorded).
      const results = await Promise.allSettled([addTx("entryDouble", 5000), addTx("entryDouble", 5000)]);
      expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
      expect(await state()).toMatchObject({ available: 6000, entries: 1, head: 1 });
    });

    it("a stale client view cannot add an entry: the counter must advance from what is stored", async () => {
      await add();
      // A second admin tab that still believes the ledger is empty.
      await assertFails(add({}, { count: 0 }));
      expect(await state()).toMatchObject({ entries: 1, head: 1 });
    });

    it("an addition and a payment at the same time both land and the books agree", async () => {
      await seedIssue("claim", { createdBy: ALICE, assignedTo: WENDY, status: "Resolved", claimAmount: 450, claimStatus: "pending" });
      const db = dbAs(ADMIN);
      const pay = async () => {
        await runTransaction(db, async (tx) => {
          const budget = await tx.get(doc(db, "finance", "budget"));
          const issue = await tx.get(doc(db, "issues", "claim"));
          if (issue.data()!.claimStatus !== "pending") return;
          expect(budget.exists()).toBe(true);
          tx.update(doc(db, "finance", "budget"), { totalSpent: increment(450), updatedAt: serverTimestamp() });
          tx.update(doc(db, "users", WENDY), { earnings: increment(450) });
          tx.set(doc(collection(db, "transactions")), {
            workerId: WENDY,
            workerName: "wendy",
            amount: 450,
            type: "receipt",
            note: "Receipt resolved for Broken light",
            issueId: "claim",
            receiptUrl: "",
            status: "approved",
            createdAt: serverTimestamp(),
          });
          tx.update(doc(db, "issues", "claim"), { claimStatus: "approved", updatedAt: serverTimestamp() });
        });
      };
      await Promise.all([assertSucceeds(addTx("entryWithPay", 5000)), assertSucceeds(pay())]);
      const budget = (await getDoc(doc(db, "finance", "budget"))).data()!;
      expect(budget.totalAvailable).toBe(6000);
      expect(budget.totalSpent).toBe(450);
      expect(await state()).toMatchObject({ entries: 1, head: 1 });
    });
  });
});

// ------------------------------------------------------------------
describe("issue photos (issues/{id}/images)", () => {
  const image = (uid: string, index = 0, overrides: Record<string, unknown> = {}) => ({
    data: IMG,
    index,
    createdBy: uid,
    createdAt: serverTimestamp(),
    ...overrides,
  });

  /** Create an issue plus photos in one commit, as the app does. */
  const createWithImages = (uid: string, images: [string, Record<string, unknown>][], issueId = "pics") => {
    const db = dbAs(uid);
    const batch = writeBatch(db);
    batch.set(doc(db, "issues", issueId), newIssue(uid, { thumbnails: [IMG], imageCount: 1 }));
    batch.set(doc(db, "rateLimits", uid), { lastIssueAt: serverTimestamp() });
    for (const [id, data] of images) batch.set(doc(db, "issues", issueId, "images", id), data);
    return batch.commit();
  };

  it("the author can attach up to three photos while creating the issue", async () => {
    await assertSucceeds(
      createWithImages(ALICE, [["0", image(ALICE, 0)], ["1", image(ALICE, 1)], ["2", image(ALICE, 2)]])
    );
    // Any signed-in user can view them (issues are campus-visible).
    await assertSucceeds(getDocs(collection(dbAs(BOB), "issues", "pics", "images")));
    await assertFails(getDocs(collection(dbAnon(), "issues", "pics", "images")));
  });

  it.each([
    ["a fourth photo", "3", {}],
    ["an arbitrary document id", "extra", {}],
    ["a javascript: URL", "0", { data: "javascript:alert(1)" }],
    ["a remote URL", "0", { data: "https://evil.example/pixel.gif" }],
    ["an SVG", "0", { data: "data:image/svg+xml;base64,PHN2Zz4=" }],
    ["an oversized image", "0", { data: `data:image/jpeg;base64,${"A".repeat(220001)}` }],
    ["someone else's name on it", "0", { createdBy: BOB }],
    ["a backdated timestamp", "0", { createdAt: new Date("2020-01-01") }],
    ["an unexpected field", "0", { caption: "hi" }],
  ])("rejects %s", async (_name, id, overrides) => {
    await assertFails(createWithImages(ALICE, [[id, image(ALICE, 0, overrides)]]));
  });

  it("photos cannot be added to, changed on, or removed from an existing issue by other users", async () => {
    await seedIssue("old", { createdBy: ALICE });
    await seed(async (db) => {
      await setDoc(doc(db, "issues", "old", "images", "0"), { data: IMG, index: 0, createdBy: ALICE, createdAt: new Date() });
    });
    // Not even the author can add one later (only at creation).
    await assertFails(setDoc(doc(dbAs(ALICE), "issues", "old", "images", "1"), image(ALICE, 1)));
    await assertFails(setDoc(doc(dbAs(BOB), "issues", "old", "images", "1"), image(BOB, 1)));
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "old", "images", "0"), { data: IMG }));
    await assertFails(deleteDoc(doc(dbAs(BOB), "issues", "old", "images", "0")));
    await assertFails(deleteDoc(doc(dbAs(WENDY), "issues", "old", "images", "0")));
  });

  it("the author can withdraw an open, unassigned issue together with its photos", async () => {
    await seedIssue("old", { createdBy: ALICE });
    await seed(async (db) => {
      await setDoc(doc(db, "issues", "old", "images", "0"), { data: IMG, index: 0, createdBy: ALICE, createdAt: new Date() });
    });
    const db = dbAs(ALICE);
    const batch = writeBatch(db);
    batch.delete(doc(db, "issues", "old", "images", "0"));
    batch.delete(doc(db, "issues", "old"));
    await assertSucceeds(batch.commit());
  });
});

// ------------------------------------------------------------------
// The exploit cases from the original audit, stated one by one.
describe("original exploit cases stay closed", () => {
  beforeEach(async () => {
    await seedIssue("alices", { createdBy: ALICE });
    await seedIssue("bobs", { createdBy: BOB });
  });

  it("user → read another user's profile: DENIED", async () => {
    await assertFails(getDoc(doc(dbAs(ALICE), "users", BOB)));
  });

  it("user → modify another user's profile: DENIED", async () => {
    await assertFails(updateDoc(doc(dbAs(ALICE), "users", BOB), { name: "x" }));
    await assertFails(setDoc(doc(dbAs(ALICE), "users", BOB), profile(BOB, "user")));
  });

  it("user → read all issues: ALLOWED by design (community feed), anonymous: DENIED", async () => {
    await assertSucceeds(getDocs(collection(dbAs(ALICE), "issues")));
    await assertFails(getDocs(collection(dbAnon(), "issues")));
  });

  it("user → modify another user's issue: DENIED", async () => {
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "bobs"), { description: "edited" }));
    await assertFails(setDoc(doc(dbAs(ALICE), "issues", "bobs"), newIssue(ALICE)));
  });

  it("user → delete another user's issue: DENIED", async () => {
    await assertFails(deleteDoc(doc(dbAs(ALICE), "issues", "bobs")));
  });

  it("user → modify own or anyone's role: DENIED", async () => {
    await assertFails(updateDoc(doc(dbAs(ALICE), "users", ALICE), { role: "admin" }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "users", ALICE), { role: "worker" }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "users", BOB), { role: "admin" }));
    await assertFails(updateDoc(doc(dbAs(WENDY), "users", WENDY), { role: "admin" }));
    await assertFails(updateDoc(doc(dbAs(WENDY), "users", ALICE), { role: "worker" }));
  });

  it("user → create or modify an admin document: DENIED", async () => {
    await assertFails(setDoc(doc(dbAs(ALICE), "admins", ALICE), { grantedAt: new Date() }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "admins", ADMIN), { x: 1 }));
    await assertFails(deleteDoc(doc(dbAs(ALICE), "admins", ADMIN)));
    await assertFails(setDoc(doc(dbAs(WENDY), "admins", WENDY), {}));
  });

  it("user → change an issue's owner: DENIED", async () => {
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "alices"), { createdBy: BOB }));
    await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "bobs"), { createdBy: ALICE }));
    await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", "bobs"), { createdBy: ADMIN }));
  });

  it("user → bypass the issue lifecycle: DENIED", async () => {
    for (const status of ["In Progress", "Resolved", "Closed", ""]) {
      await assertFails(updateDoc(doc(dbAs(ALICE), "issues", "alices"), { status, updatedAt: serverTimestamp() }));
    }
  });

  it("every lifecycle transition: only Open → In Progress → Resolved is allowed", async () => {
    const statuses = ["Open", "In Progress", "Resolved"];
    const allowed = new Set(["Open>In Progress", "In Progress>Resolved"]);
    for (const from of statuses) {
      for (const to of statuses) {
        if (from === to) continue;
        const id = `t-${from}-${to}`.replace(/ /g, "");
        await seedIssue(id, { createdBy: ALICE, assignedTo: WENDY, status: from });
        const change = {
          status: to,
          updatedAt: serverTimestamp(),
          ...(to === "In Progress" ? { startedAt: serverTimestamp() } : {}),
          ...(to === "Resolved" ? { resolvedAt: serverTimestamp() } : {}),
        };
        const asWorker = updateDoc(doc(dbAs(WENDY), "issues", id), change);
        if (allowed.has(`${from}>${to}`)) {
          await assertSucceeds(asWorker);
        } else {
          await assertFails(asWorker);
          // An admin can't force it either.
          await assertFails(updateDoc(doc(dbAs(ADMIN), "issues", id), change));
        }
      }
    }
  });
});
