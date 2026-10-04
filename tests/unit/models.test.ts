import { describe, expect, it } from "vitest";
import { canTransition } from "@/lib/constants";
import { formatDate, toDate, toDateOr } from "@/lib/dates";
import { ValidationError, getFriendlyErrorMessage } from "@/lib/errors";
import {
  normalizeBudget,
  normalizeChatMessage,
  normalizeIssue,
  normalizeTransaction,
  normalizeUser,
} from "@/lib/models";
import { dashboardPathForRole, getAvailableRoles, resolveActiveRole } from "@/lib/roles";
import { User } from "@/types";

/** Stand-in for a Firestore Timestamp. */
const timestamp = (iso: string) => ({ toDate: () => new Date(iso) });

describe("toDate", () => {
  it("converts Firestore timestamps, ISO strings, numbers and Dates", () => {
    const iso = "2026-03-01T10:00:00.000Z";
    expect(toDate(timestamp(iso))?.toISOString()).toBe(iso);
    expect(toDate(iso)?.toISOString()).toBe(iso);
    expect(toDate(Date.parse(iso))?.toISOString()).toBe(iso);
    expect(toDate(new Date(iso))?.toISOString()).toBe(iso);
  });

  it.each([null, undefined, "", "not a date", NaN, {}, [], new Date("nope")])(
    "returns undefined instead of an Invalid Date for %j",
    (value) => {
      expect(toDate(value)).toBeUndefined();
    }
  );

  it("survives a timestamp whose toDate throws", () => {
    expect(toDate({ toDate: () => { throw new Error("corrupt"); } })).toBeUndefined();
  });

  it("toDateOr falls back", () => {
    const fallback = new Date(0);
    expect(toDateOr(null, fallback)).toBe(fallback);
  });

  it("formatDate never renders 'Invalid Date'", () => {
    expect(formatDate("garbage")).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("2026-03-01T10:00:00.000Z")).toMatch(/2026/);
  });
});

describe("normalizeIssue", () => {
  it("maps a well-formed document", () => {
    const issue = normalizeIssue("abc", {
      title: "Broken light",
      description: "Flickers",
      category: "Electrical",
      priority: "High",
      status: "In Progress",
      location: "Block A",
      createdBy: "u1",
      createdByName: "Asha",
      assignedTo: "w1",
      createdAt: timestamp("2026-03-01T10:00:00.000Z"),
      updatedAt: timestamp("2026-03-01T11:00:00.000Z"),
      upvotes: 2,
      upvotedBy: ["u2", "u3"],
      escalated: true,
      imageUrls: ["data:image/png;base64,AAAA"],
      claimAmount: 500,
      claimStatus: "pending",
    });

    expect(issue).toMatchObject({
      id: "abc",
      title: "Broken light",
      priority: "High",
      status: "In Progress",
      assignedTo: "w1",
      upvotes: 2,
      escalated: true,
      claimAmount: 500,
      claimStatus: "pending",
      imageUrls: ["data:image/png;base64,AAAA"],
    });
    expect(issue.createdAt.toISOString()).toBe("2026-03-01T10:00:00.000Z");
  });

  it("produces a safe, fully populated issue from an empty document", () => {
    const issue = normalizeIssue("empty", {});
    expect(issue.title).toBe("Untitled issue");
    expect(issue.category).toBe("General");
    expect(issue.priority).toBe("Low");
    expect(issue.status).toBe("Open");
    expect(issue.assignedTo).toBe("");
    expect(issue.upvotes).toBe(0);
    expect(issue.upvotedBy).toEqual([]);
    expect(issue.imageUrls).toEqual([]);
    expect(Number.isNaN(issue.createdAt.getTime())).toBe(false);
    expect(Number.isNaN(issue.updatedAt.getTime())).toBe(false);
  });

  it("tolerates null/undefined data and wrong types", () => {
    expect(() => normalizeIssue("x", null)).not.toThrow();
    expect(() => normalizeIssue("x", undefined)).not.toThrow();

    const issue = normalizeIssue("bad", {
      title: 123,
      priority: "Critical",
      status: "RandomInvalidState",
      upvotes: "many",
      upvotedBy: "u1",
      createdAt: "not a date",
      escalated: "yes",
      claimAmount: -50,
      claimStatus: "paid",
    });
    expect(issue.title).toBe("Untitled issue");
    expect(issue.priority).toBe("Low");
    expect(issue.status).toBe("Open");
    expect(issue.upvotes).toBe(0);
    expect(issue.upvotedBy).toEqual([]);
    expect(issue.escalated).toBe(false);
    expect(issue.claimAmount).toBe(0);
    expect(issue.claimStatus).toBeUndefined();
    expect(Number.isNaN(issue.createdAt.getTime())).toBe(false);
  });

  it("drops image and receipt URLs that aren't inline images", () => {
    const issue = normalizeIssue("x", {
      imageUrls: ["javascript:alert(1)", "https://evil.example/pixel.gif", "data:image/jpeg;base64,AAAA"],
      receiptUrl: "javascript:alert(document.cookie)",
    });
    expect(issue.imageUrls).toEqual(["data:image/jpeg;base64,AAAA"]);
    expect(issue.receiptUrl).toBe("");
  });

  it("reads the legacy single imageUrl field", () => {
    const issue = normalizeIssue("x", { imageUrl: "data:image/png;base64,AAAA" });
    expect(issue.imageUrls).toEqual(["data:image/png;base64,AAAA"]);
  });

  it("uses stored thumbnails and flags that full images live in the subcollection", () => {
    const issue = normalizeIssue("x", {
      thumbnails: ["data:image/jpeg;base64,AAAA", "javascript:alert(1)", "data:image/jpeg;base64,BBBB"],
      imageCount: 99, // untrusted: the count is derived from what is actually displayable
      imageUrls: [],
    });
    expect(issue.thumbnails).toEqual(["data:image/jpeg;base64,AAAA", "data:image/jpeg;base64,BBBB"]);
    expect(issue.imageCount).toBe(2);
    expect(issue.hasImageDocs).toBe(true);
  });

  it("falls back to in-document images as previews for legacy issues", () => {
    const issue = normalizeIssue("x", { imageUrls: ["data:image/png;base64,AAAA"] });
    expect(issue.thumbnails).toEqual(["data:image/png;base64,AAAA"]);
    expect(issue.imageCount).toBe(1);
    expect(issue.hasImageDocs).toBe(false);
  });

  it("reports a receipt for both the new flag and a legacy inline receipt", () => {
    expect(normalizeIssue("x", { hasReceipt: true }).hasReceipt).toBe(true);
    expect(normalizeIssue("x", { receiptUrl: "data:image/png;base64,AAAA" }).hasReceipt).toBe(true);
    expect(normalizeIssue("x", { hasReceipt: "yes" }).hasReceipt).toBe(false);
    expect(normalizeIssue("x", {}).hasReceipt).toBe(false);
  });

  it("keeps pending server timestamps (null) from breaking dates", () => {
    const issue = normalizeIssue("x", { createdAt: null, updatedAt: null });
    expect(issue.createdAt).toBeInstanceOf(Date);
    expect(issue.updatedAt.getTime()).toBe(issue.createdAt.getTime());
  });
});

describe("other normalisers", () => {
  it("normalizeUser ignores unknown roles", () => {
    const user = normalizeUser("u1", { name: "A", email: "a@b.co", role: "superadmin", activeRole: "root" });
    expect(user.role).toBe("user");
    expect(user.activeRole).toBe("user");
    expect(user.earnings).toBe(0);
  });

  it("normalizeUser keeps a valid worker request and drops anything else", () => {
    expect(normalizeUser("u1", { workerRequest: "pending" }).workerRequest).toBe("pending");
    expect(normalizeUser("u1", { workerRequest: "granted-by-me" }).workerRequest).toBeUndefined();
    expect(normalizeUser("u1", {}).workerRequest).toBeUndefined();
  });

  it("normalizeUser reads ISO-string createdAt from existing profiles", () => {
    const user = normalizeUser("u1", { createdAt: "2026-01-05T00:00:00.000Z" });
    expect(user.createdAt.toISOString()).toBe("2026-01-05T00:00:00.000Z");
  });

  it("normalizeChatMessage, normalizeBudget and normalizeTransaction fill gaps", () => {
    expect(normalizeChatMessage("m", {}).authorRole).toBe("user");
    expect(normalizeBudget("budget", { totalAvailable: "lots" })).toMatchObject({ totalAvailable: 0, totalSpent: 0 });
    expect(normalizeTransaction("t", { amount: null })).toMatchObject({ amount: 0, type: "receipt" });
  });
});

describe("issue lifecycle", () => {
  it("allows only single forward steps", () => {
    expect(canTransition("Open", "In Progress")).toBe(true);
    expect(canTransition("In Progress", "Resolved")).toBe(true);
  });

  it.each([
    ["Open", "Resolved"],
    ["Resolved", "Open"],
    ["Resolved", "In Progress"],
    ["In Progress", "Open"],
    ["Open", "Open"],
  ] as const)("rejects %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });
});

describe("roles", () => {
  const profile = (role: User["role"], activeRole?: User["role"]): User => ({
    id: "u1",
    name: "A",
    email: "a@b.co",
    role,
    activeRole,
    createdAt: new Date(),
  });

  it("gives a plain user only the user role", () => {
    expect(getAvailableRoles(profile("user"), false)).toEqual(["user"]);
  });

  it("gives a worker the user and worker roles", () => {
    expect(getAvailableRoles(profile("worker"), false)).toEqual(["user", "worker"]);
  });

  it("gives no worker access while a request is only pending", () => {
    const pending: User = { ...profile("user"), workerRequest: "pending" };
    expect(getAvailableRoles(pending, false)).toEqual(["user"]);
    expect(resolveActiveRole({ ...pending, activeRole: "worker" }, false)).toBe("user");
  });

  it("gives an admin grant every role", () => {
    expect(getAvailableRoles(profile("user"), true)).toEqual(["user", "worker", "admin"]);
  });

  it("does not treat a self-written role of 'admin' as an admin grant", () => {
    // Older profiles could set role/activeRole to "admin" themselves.
    const legacy = profile("admin", "admin");
    expect(getAvailableRoles(legacy, false)).toEqual(["user"]);
    expect(resolveActiveRole(legacy, false)).toBe("user");
  });

  it("ignores an activeRole the account isn't entitled to", () => {
    expect(resolveActiveRole(profile("user", "worker"), false)).toBe("user");
    expect(resolveActiveRole(profile("worker", "admin"), false)).toBe("worker");
  });

  it("honours a valid activeRole", () => {
    expect(resolveActiveRole(profile("worker", "user"), false)).toBe("user");
    expect(resolveActiveRole(profile("user", "admin"), true)).toBe("admin");
  });

  it("has no roles without a profile", () => {
    expect(getAvailableRoles(null, true)).toEqual([]);
    expect(resolveActiveRole(null, true)).toBe("user");
  });

  it("maps roles to dashboards, defaulting to the user dashboard", () => {
    expect(dashboardPathForRole("admin")).toBe("/admin");
    expect(dashboardPathForRole("worker")).toBe("/worker");
    expect(dashboardPathForRole("user")).toBe("/dashboard");
    expect(dashboardPathForRole("hacker")).toBe("/dashboard");
    expect(dashboardPathForRole(null)).toBe("/dashboard");
  });
});

describe("getFriendlyErrorMessage", () => {
  it("maps known Firebase codes to user-facing text", () => {
    expect(getFriendlyErrorMessage({ code: "auth/invalid-credential" })).toBe("Invalid email or password.");
    expect(getFriendlyErrorMessage({ code: "permission-denied" })).toBe("You don't have permission to do that.");
  });

  it("gives the same message for unknown user and wrong password (no account enumeration)", () => {
    expect(getFriendlyErrorMessage({ code: "auth/user-not-found" })).toBe(
      getFriendlyErrorMessage({ code: "auth/wrong-password" })
    );
  });

  it("passes validation messages through", () => {
    expect(getFriendlyErrorMessage(new ValidationError("Please enter a location."))).toBe("Please enter a location.");
  });

  it("never leaks raw error text for unknown errors", () => {
    const raw = new Error("FirebaseError: [code=internal]: stack trace at lib/firestore.ts:42");
    const message = getFriendlyErrorMessage(raw, "Unable to submit your issue right now. Please try again.");
    expect(message).toBe("Unable to submit your issue right now. Please try again.");
    expect(message).not.toContain("Firebase");
    expect(getFriendlyErrorMessage({ code: "some/unknown-code", message: "internal detail" })).not.toContain("internal");
  });
});
