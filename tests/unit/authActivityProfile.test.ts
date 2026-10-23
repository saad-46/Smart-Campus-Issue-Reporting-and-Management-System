import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { issueActivity } from "@/lib/activity";
import { describeCameraError, detectCameraSupport, liveCameraBlocker } from "@/lib/camera";
import { normalizeUser } from "@/lib/models";
import { normalizeStudentProfile, studentProfileErrors, validateStudentProfile } from "@/lib/validation";
import { ValidationError } from "@/lib/errors";
import { assertImageFile } from "@/lib/image";
import { Issue } from "@/types";

const ROOT = process.cwd();
const T = (n: number) => new Date(Date.UTC(2026, 9, 20, n));

function issue(over: Partial<Issue>): Issue {
  return {
    id: "i1",
    title: "Fan",
    description: "",
    category: "Electrical",
    priority: "Medium",
    status: "Open",
    location: "Block 1",
    createdBy: "alice",
    createdByName: "Alice",
    assignedTo: "",
    thumbnails: [],
    imageCount: 0,
    hasImageDocs: false,
    hasReceipt: false,
    createdAt: T(1),
    updatedAt: T(1),
    upvotes: 0,
    upvotedBy: [],
    aiSummary: "",
    aiConfidence: null,
    aiDepartment: "",
    locationId: "",
    duplicateOf: "",
    ...over,
  };
}

describe("signed-in timeline (issueActivity)", () => {
  const mine = issue({ id: "mine", createdBy: "alice", createdAt: T(1), startedAt: T(3), resolvedAt: T(5) });
  const theirs = issue({ id: "theirs", createdBy: "bob", createdByName: "Bob", createdAt: T(2), startedAt: T(4), resolvedAt: T(6), duplicateOf: "mine" });

  it("shows staff every recorded step, newest first", () => {
    const rows = issueActivity([mine, theirs], { id: "wendy", role: "worker" });
    expect(new Set(rows.map((r) => r.id)).size).toBe(7);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].at.getTime()).toBeGreaterThanOrEqual(rows[i].at.getTime());
    expect(rows).toHaveLength(7);
  });

  it("shows a student every new report but the progress of their own issues only", () => {
    const rows = issueActivity([mine, theirs], { id: "alice", role: "user" });
    expect(rows.filter((r) => r.issue.id === "theirs").map((r) => r.type)).toEqual(["reported"]);
    expect(rows.filter((r) => r.issue.id === "mine").map((r) => r.type).sort()).toEqual(["reported", "resolved", "started"]);
  });

  it("shows staff the reporter by name, but a student only \"you\" or \"another student\"", () => {
    const staff = issueActivity([mine, theirs], { id: "wendy", role: "worker" }).filter((r) => r.type === "reported").map((r) => r.text);
    expect(staff.some((t) => t.includes("Bob"))).toBe(true);
    const student = issueActivity([mine, theirs], { id: "alice", role: "user" }).filter((r) => r.type === "reported").map((r) => r.text);
    expect(student.join("|")).not.toMatch(/Bob|Alice/);
    expect(student.some((t) => t.startsWith("Reported by you"))).toBe(true);
    expect(student.some((t) => t.startsWith("Reported by another student"))).toBe(true);
  });

  it("invents nothing: no started or resolved entry without a real timestamp", () => {
    const rows = issueActivity([issue({ id: "x" })], { id: "admin1", role: "admin" });
    expect(rows.map((r) => r.type)).toEqual(["reported"]);
    expect(issueActivity([issue({ id: "bad", createdAt: new Date("nope") })], { id: "admin1", role: "admin" })).toEqual([]);
  });

  it("honours the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => issue({ id: `n${i}`, createdAt: T(i % 20) }));
    expect(issueActivity(many, { id: "admin1", role: "admin" }, 10)).toHaveLength(10);
  });
});

describe("student profile validation", () => {
  const ok = { college: "  Sultan-ul-Uloom  College ", rollNumber: " 1604-21-737-001 ", academicYear: "3rd year", branch: "Computer Science" };

  it("normalises: trims, collapses spaces, upper-cases the roll number", () => {
    expect(normalizeStudentProfile({ ...ok, rollNumber: "ab-12/c" })).toEqual({ college: "Sultan-ul-Uloom College", rollNumber: "AB-12/C", academicYear: "3rd year", branch: "Computer Science" });
  });

  it("accepts a complete profile and names every field that is wrong", () => {
    expect(studentProfileErrors(ok)).toEqual({});
    expect(Object.keys(studentProfileErrors({}))).toEqual(["college", "rollNumber", "academicYear", "branch"]);
    expect(studentProfileErrors({ ...ok, academicYear: "9th year" }).academicYear).toBeTruthy();
    expect(studentProfileErrors({ ...ok, rollNumber: "<script>" }).rollNumber).toBeTruthy();
    expect(studentProfileErrors({ ...ok, college: "x".repeat(121) }).college).toBeTruthy();
    expect(studentProfileErrors({ ...ok, branch: "x" }).branch).toBeTruthy();
    expect(studentProfileErrors({ ...ok, college: 42 as unknown as string }).college).toBeTruthy();
  });

  it("throws a ValidationError for the first problem and otherwise returns clean data", () => {
    expect(() => validateStudentProfile({ ...ok, branch: "" })).toThrow(ValidationError);
    expect(validateStudentProfile(ok).college).toBe("Sultan-ul-Uloom College");
  });

  it("reads the four fields back from a stored profile only when all are present", () => {
    const base = { name: "A", email: "a@x.test", role: "user", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(normalizeUser("u1", { ...base, college: "C1", rollNumber: "R1", academicYear: "1st year", branch: "B1" }).student).toEqual({ college: "C1", rollNumber: "R1", academicYear: "1st year", branch: "B1" });
    expect(normalizeUser("u1", { ...base, college: "C1" }).student).toBeUndefined();
    expect(normalizeUser("u1", base).student).toBeUndefined();
  });
});

describe("camera helpers", () => {
  const md = { getUserMedia: () => undefined };
  it("offers the live camera only in a secure context with getUserMedia", () => {
    expect(detectCameraSupport({ isSecureContext: true, mediaDevices: md })).toEqual({ live: true, nativeCapture: false });
    expect(detectCameraSupport({ isSecureContext: false, mediaDevices: md }).live).toBe(false);
    expect(detectCameraSupport({ isSecureContext: true, mediaDevices: null }).live).toBe(false);
    expect(detectCameraSupport({ isSecureContext: true, mediaDevices: md, coarsePointer: true }).nativeCapture).toBe(true);
    expect(liveCameraBlocker({ isSecureContext: false, mediaDevices: md })).toBe("insecure");
    expect(liveCameraBlocker({ isSecureContext: true, mediaDevices: {} })).toBe("unsupported");
    expect(liveCameraBlocker({ isSecureContext: true, mediaDevices: md })).toBeNull();
  });

  it("turns each browser failure into something a person can act on, always offering the upload path", () => {
    expect(describeCameraError({ name: "NotAllowedError" }).reason).toBe("denied");
    expect(describeCameraError({ name: "NotAllowedError" }).message).toMatch(/site settings/i);
    expect(describeCameraError({ name: "NotFoundError" }).reason).toBe("no-camera");
    expect(describeCameraError({ name: "NotReadableError" }).reason).toBe("in-use");
    expect(describeCameraError(new TypeError("x")).reason).toBe("unsupported");
    expect(describeCameraError("weird").reason).toBe("other");
    for (const name of ["NotAllowedError", "NotFoundError", "NotReadableError", "TypeError", "Other"]) expect(describeCameraError({ name }).message).toMatch(/upload|try again/i);
  });

  it("rejects an empty, non-image or oversized file before reading it", () => {
    expect(() => assertImageFile(new File([], "a.jpg", { type: "image/jpeg" }))).toThrow(/empty/i);
    expect(() => assertImageFile(new File(["x"], "a.gif", { type: "image/gif" }))).toThrow(/JPG, PNG or WebP/);
    expect(() => assertImageFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "a.png", { type: "image/png" }))).toThrow(/smaller than/);
    expect(() => assertImageFile(new File(["x"], "a.png", { type: "image/png" }))).not.toThrow();
  });
});

describe("signed-in navigation", () => {
  const source = readFileSync(join(ROOT, "components", "shell", "nav.tsx"), "utf8");

  it("gives every role the same Activity group, as Explore does", () => {
    expect(source).toContain('label: "Activity"');
    for (const [label, href] of [["Notifications", "/notifications"], ["Search", "/search"], ["Timeline", "/timeline"]]) {
      expect(source).toContain(`label: "${label}", href: "${href}"`);
      expect(existsSync(join(ROOT, "app", "(app)", ...href.split("/").filter(Boolean), "page.tsx")), href).toBe(true);
    }
    // One definition, included for all three roles.
    expect(source.match(/\bactivity,\r?\n/g)?.length).toBe(3);
  });

  it("has no How it works entry, while Explore keeps its Help section", () => {
    expect(source).not.toMatch(/how it works/i);
    expect(readFileSync(join(ROOT, "lib", "viewer", "nav.ts"), "utf8")).toContain("How it works");
  });

  it("protects the new pages with the same guard as search", () => {
    for (const dir of ["notifications", "timeline"]) {
      const layout = readFileSync(join(ROOT, "app", "(app)", dir, "layout.tsx"), "utf8");
      expect(layout).toContain("ProtectedRoute");
      expect(layout).toContain("AppShell");
    }
  });
});

describe("the sign-in role chooser", () => {
  it("offers exactly Student, Worker and Admin and proves nothing by itself", () => {
    const page = readFileSync(join(ROOT, "app", "(app)", "sign-in", "page.tsx"), "utf8");
    for (const label of ["Sign in as Student", "Sign in as Worker", "Sign in as Admin"]) expect(page).toContain(label);
    expect(page).toContain("/login?role=");
  });

  it("verifies the chosen role against the account's granted roles and signs out when it is missing", () => {
    const login = readFileSync(join(ROOT, "app", "(app)", "login", "page.tsx"), "utf8");
    expect(login).toContain("availableRoles.includes(wanted)");
    expect(login).toMatch(/signOut\(\)/);
  });
});
