// Rollback safety: the PREVIOUS release's rules (fixtures/previous-release.rules,
// the file at commit 4de4e74) must keep accepting everything the previous
// application does, against data the NEW application has written.
//
// Restoring the old rules is the documented rollback. This test is its
// evidence: it seeds the documents the new release leaves behind (funds ledger
// and head, conversations, payment records with the new fields, a budget
// document that has seen additions) and then runs the old application's
// operations under the old rules.
//
//   npm run test:rules

import { readFileSync } from "fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";

const ALICE = "alice";
const WENDY = "wendy";
const ADMIN = "admin1";

let env: RulesTestEnvironment;
const dbAs = (uid: string) => env.authenticatedContext(uid, { email: `${uid}@example.com` }).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-unifix-rollback",
    firestore: { rules: readFileSync("tests/rules/fixtures/previous-release.rules", "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const user = (uid: string, role: string) => ({ id: uid, name: uid, email: `${uid}@example.com`, role, roles: [role], activeRole: role, createdAt: new Date() });
    await setDoc(doc(db, "users", ALICE), user(ALICE, "user"));
    await setDoc(doc(db, "users", WENDY), user(WENDY, "worker"));
    await setDoc(doc(db, "users", ADMIN), user(ADMIN, "user"));
    await setDoc(doc(db, "admins", ADMIN), { grantedAt: new Date() });

    // What the new release leaves behind after funds were added and a claim was paid.
    await setDoc(doc(db, "finance", "budget"), { totalAvailable: 506_000, totalSpent: 450, updatedAt: new Date() });
    await setDoc(doc(db, "ledger", "entry1"), {
      type: "funds_added",
      amount: 5000,
      source: "management_allocation",
      description: "Q3 allocation",
      receivedOn: "2026-10-01",
      createdBy: ADMIN,
      createdAt: new Date(),
    });
    await setDoc(doc(db, "ledgerHead", "state"), { lastEntryId: "entry1", entryCount: 1, updatedAt: new Date() });
    await setDoc(doc(db, "transactions", "t-new"), {
      workerId: WENDY,
      workerName: "wendy",
      amount: 450,
      type: "receipt",
      note: "Receipt resolved for Broken light",
      issueId: "paid",
      receiptUrl: "",
      status: "approved",
      method: "bank_transfer",
      reference: "UTR123456",
      paidOn: "2026-10-10",
      verification: "manual",
      recordedBy: ADMIN,
      createdAt: new Date(),
    });
    const issue = (overrides: Record<string, unknown>) => ({
      title: "Broken light",
      description: "The light is broken in the corridor",
      category: "Electrical",
      priority: "Medium",
      location: "Block 1",
      status: "Resolved",
      createdBy: ALICE,
      createdByName: ALICE,
      assignedTo: WENDY,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    await setDoc(doc(db, "issues", "paid"), issue({ claimAmount: 450, claimStatus: "approved" }));
    await setDoc(doc(db, "issues", "claim"), issue({ claimAmount: 300, claimStatus: "pending" }));
    await setDoc(doc(db, "issues", "chat"), issue({ status: "In Progress" }));
    await setDoc(doc(db, "conversations", "chat"), {
      issueId: "chat",
      studentId: ALICE,
      workerId: WENDY,
      participants: [ALICE, WENDY],
      createdAt: new Date(),
      lastMessageAt: new Date(),
      lastSenderId: WENDY,
      lastPreview: "On my way",
      readAt: { [WENDY]: new Date() },
    });
  });
});

describe("the previous rules against data the new release wrote", () => {
  it("the budget document still has its original keys", async () => {
    const budget = (await getDoc(doc(dbAs(ADMIN), "finance", "budget"))).data()!;
    expect(Object.keys(budget).sort()).toEqual(["totalAvailable", "totalSpent", "updatedAt"]);
  });

  it("the previous app can still add funds (a budget increase with no ledger entry)", async () => {
    await assertSucceeds(updateDoc(doc(dbAs(ADMIN), "finance", "budget"), { totalAvailable: increment(1000), updatedAt: serverTimestamp() }));
  });

  it("the previous app can still pay a pending claim (budget, earnings, entry and claim in one commit)", async () => {
    const db = dbAs(ADMIN);
    const batch = writeBatch(db);
    batch.update(doc(db, "finance", "budget"), { totalSpent: increment(300), updatedAt: serverTimestamp() });
    batch.update(doc(db, "users", WENDY), { earnings: increment(300) });
    batch.set(doc(collection(db, "transactions")), {
      workerId: WENDY,
      workerName: "wendy",
      amount: 300,
      type: "receipt",
      note: "Receipt resolved for Broken light",
      issueId: "claim",
      receiptUrl: "",
      status: "approved",
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "issues", "claim"), { claimStatus: "approved", updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  it("a claim already paid under the new release cannot be paid again", async () => {
    const db = dbAs(ADMIN);
    const batch = writeBatch(db);
    batch.update(doc(db, "finance", "budget"), { totalSpent: increment(450), updatedAt: serverTimestamp() });
    batch.set(doc(collection(db, "transactions")), {
      workerId: WENDY,
      workerName: "wendy",
      amount: 450,
      type: "receipt",
      note: "again",
      issueId: "paid",
      receiptUrl: "",
      status: "approved",
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "issues", "paid"), { claimStatus: "approved", updatedAt: serverTimestamp() });
    await assertFails(batch.commit());
  });

  it("workers still read their own payments, including those with the new fields", async () => {
    const snap = await assertSucceeds(getDocs(query(collection(dbAs(WENDY), "transactions"), where("workerId", "==", WENDY))));
    expect(snap.docs.some((d) => d.data().method === "bank_transfer")).toBe(true);
    await assertFails(getDoc(doc(dbAs(ALICE), "transactions", "t-new")));
  });

  it("issue chat keeps working for the reporter and the assignee (the previous thread rules)", async () => {
    const message = (uid: string, role: string) => ({ text: "hello", authorId: uid, authorName: uid, authorRole: role, createdAt: serverTimestamp() });
    await assertSucceeds(addDoc(collection(dbAs(ALICE), "issues", "chat", "messages"), message(ALICE, "user")));
    await assertSucceeds(addDoc(collection(dbAs(WENDY), "issues", "chat", "messages"), message(WENDY, "worker")));
    await assertSucceeds(addDoc(collection(dbAs(ADMIN), "issues", "chat", "messages"), message(ADMIN, "admin")));
  });

  it("collections only the new release knows about are closed, not open: the previous rules deny them", async () => {
    // Nobody can read or write them while the old rules are in force.
    await assertFails(getDoc(doc(dbAs(ADMIN), "ledger", "entry1")));
    await assertFails(getDoc(doc(dbAs(ADMIN), "ledgerHead", "state")));
    await assertFails(getDoc(doc(dbAs(ALICE), "conversations", "chat")));
    await assertFails(setDoc(doc(dbAs(ADMIN), "ledgerHead", "state"), { lastEntryId: "x", entryCount: 9 }));
  });

  it("the fund-and-pay sequence of the previous app works end to end on the same budget", async () => {
    const db = dbAs(ADMIN);
    await assertSucceeds(updateDoc(doc(db, "finance", "budget"), { totalAvailable: increment(2000), updatedAt: serverTimestamp() }));
    const batch = writeBatch(db);
    batch.update(doc(db, "finance", "budget"), { totalSpent: increment(300), updatedAt: serverTimestamp() });
    batch.update(doc(db, "users", WENDY), { earnings: increment(300) });
    batch.set(doc(collection(db, "transactions")), {
      workerId: WENDY,
      workerName: "wendy",
      amount: 300,
      type: "receipt",
      note: "Receipt resolved for Broken light",
      issueId: "claim",
      receiptUrl: "",
      status: "approved",
      createdAt: serverTimestamp(),
    });
    batch.update(doc(db, "issues", "claim"), { claimStatus: "approved", updatedAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
    const budget = (await getDoc(doc(db, "finance", "budget"))).data()!;
    expect(budget.totalAvailable).toBe(508_000);
    expect(budget.totalSpent).toBe(750);
  });
});
