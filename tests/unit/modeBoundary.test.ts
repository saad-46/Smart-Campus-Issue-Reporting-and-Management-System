import { beforeEach, describe, expect, it, vi } from "vitest";

// The signed-in data layer, with Firestore replaced by spies. These tests
// prove the two directions of the Explore / signed-in boundary that the
// demo-engine tests can't: a demo record is refused before any Firestore
// call, and a failed real write is reported as a failure, never as success.

const firestore = vi.hoisted(() => ({
  runTransaction: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  setDoc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  writeBatch: vi.fn(),
  doc: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
  collection: vi.fn((_db: unknown, ...path: string[]) => ({ path: path.join("/") })),
}));

vi.mock("@/lib/firebase", () => ({ db: { __fake: true }, auth: { currentUser: null } }));
vi.mock("firebase/firestore", async () => {
  const passthrough = () => ({});
  return {
    ...firestore,
    query: passthrough,
    where: passthrough,
    orderBy: passthrough,
    limit: passthrough,
    startAfter: passthrough,
    onSnapshot: vi.fn(() => () => undefined),
    serverTimestamp: () => "SERVER_TIME",
    increment: (n: number) => ({ increment: n }),
    arrayUnion: (...v: unknown[]) => ({ arrayUnion: v }),
    arrayRemove: (...v: unknown[]) => ({ arrayRemove: v }),
    deleteField: () => "DELETE",
    documentId: () => "__name__",
    getCountFromServer: vi.fn(),
    Timestamp: { fromDate: (d: Date) => d, now: () => new Date() },
  };
});

import { adminAssignIssue, assignIssue, deleteIssue, linkIssueToIncident, setIssueEscalation, submitBill, toggleUpvote, updateIssueStatus } from "@/lib/firestore";
import { approveClaim, rejectReceipt } from "@/lib/finance";
import { assertRealId, isDemoId } from "@/lib/sharedRules";
import { createDemoState } from "@/lib/viewer/demoStore";
import { ValidationError } from "@/lib/errors";

const admin = { id: "adminUid", name: "Admin", role: "admin" as const };
const worker = { id: "workerUid", name: "Worker", role: "worker" as const };
const writes = () => [firestore.runTransaction, firestore.updateDoc, firestore.deleteDoc, firestore.setDoc, firestore.addDoc, firestore.writeBatch];

beforeEach(() => {
  for (const fn of Object.values(firestore)) if ("mockClear" in fn) fn.mockClear();
  Object.defineProperty(globalThis, "navigator", { value: { onLine: true }, configurable: true });
});

describe("demo records can't be written to Firestore", () => {
  it("recognises every id the demo produces, and no real-looking id", () => {
    const state = createDemoState(new Date("2026-10-09T10:00:00Z"));
    for (const i of state.data.issues) expect(isDemoId(i.id)).toBe(true);
    for (const id of ["SC-1146", "TX-1012", "demo-w-3", "demo-n-0", "demo-m-seed-SC-1140-0"]) expect(isDemoId(id)).toBe(true);
    // Firestore auto ids and the emulator seed ids are never mistaken for demo ids.
    for (const id of ["3GGhQ1x9aBcD4eFgH5iJ", "seed00012k3j", "abcDEF123456", "", "SC-", "sc-1140", "xSC-1140", null, undefined, 1140]) expect(isDemoId(id)).toBe(false);
    expect(() => assertRealId("SC-1140")).toThrow(ValidationError);
    expect(() => assertRealId("3GGhQ1x9aBcD4eFgH5iJ")).not.toThrow();
  });

  it.each<[string, () => Promise<unknown>]>([
    ["updateIssueStatus", () => updateIssueStatus("SC-1140", "In Progress", worker)],
    ["adminAssignIssue", () => adminAssignIssue("SC-1140", "workerUid", admin)],
    ["setIssueEscalation", () => setIssueEscalation("SC-1140", true)],
    ["linkIssueToIncident", () => linkIssueToIncident("SC-1141", "SC-1140", admin)],
    ["submitBill", () => submitBill("SC-1140", worker, 100, "", "parts")],
    ["assignIssue", () => assignIssue("SC-1140", "workerUid")],
    ["deleteIssue", () => deleteIssue("SC-1140")],
    ["toggleUpvote", () => toggleUpvote("SC-1140", "studentUid")],
    ["approveClaim", () => approveClaim("SC-1140", "Worker", "adminUid", { method: "cash", reference: "", paidOn: "2026-10-09" })],
    ["rejectReceipt", () => rejectReceipt("SC-1140", "adminUid")],
  ])("%s refuses a demo issue before touching Firestore", async (_name, call) => {
    await expect(call()).rejects.toThrow(/belongs to the demo/);
    for (const fn of writes()) expect(fn).not.toHaveBeenCalled();
    expect(firestore.doc).not.toHaveBeenCalled();
  });
});

describe("a failed real write is a failure", () => {
  it.each<[string, () => Promise<unknown>]>([
    ["updateIssueStatus", () => updateIssueStatus("3GGhQ1x9aBcD4eFgH5iJ", "In Progress", worker)],
    ["adminAssignIssue", () => adminAssignIssue("3GGhQ1x9aBcD4eFgH5iJ", "workerUid", admin)],
    ["assignIssue", () => assignIssue("3GGhQ1x9aBcD4eFgH5iJ", "workerUid")],
    ["approveClaim", () => approveClaim("3GGhQ1x9aBcD4eFgH5iJ", "Worker", "adminUid", { method: "cash", reference: "", paidOn: "2026-10-09" })],
    ["rejectReceipt", () => rejectReceipt("3GGhQ1x9aBcD4eFgH5iJ", "adminUid")],
  ])("%s rejects when Firestore denies it, and nothing falls back to the demo", async (_name, call) => {
    const denied = Object.assign(new Error("Missing or insufficient permissions."), { code: "permission-denied" });
    firestore.runTransaction.mockRejectedValue(denied);
    firestore.updateDoc.mockRejectedValue(denied);
    await expect(call()).rejects.toBe(denied);
    // The real path was the one that ran.
    expect(firestore.runTransaction.mock.calls.length + firestore.updateDoc.mock.calls.length).toBeGreaterThan(0);
  });

  it("setIssueEscalation surfaces a denied write", async () => {
    const denied = Object.assign(new Error("denied"), { code: "permission-denied" });
    firestore.updateDoc.mockRejectedValue(denied);
    firestore.runTransaction.mockRejectedValue(denied);
    await expect(setIssueEscalation("3GGhQ1x9aBcD4eFgH5iJ", true)).rejects.toBe(denied);
  });
});
