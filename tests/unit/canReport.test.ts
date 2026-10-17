import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { canReportIssues } from "@/lib/roles";
import { User } from "@/types";

const profile = (role: User["role"], activeRole: User["activeRole"] = role): User =>
  ({ id: "u1", name: "Test", email: "t@example.com", role, roles: [role], activeRole, createdAt: new Date() }) as User;

describe("who is offered issue reporting (mirrors canReport() in firestore.rules)", () => {
  it("students can report", () => {
    expect(canReportIssues(profile("user"), false)).toBe(true);
  });

  it("administrators can report, even when their stored role is worker", () => {
    expect(canReportIssues(profile("user"), true)).toBe(true);
    expect(canReportIssues(profile("worker"), true)).toBe(true);
  });

  it("a worker cannot, whichever view they have switched to", () => {
    expect(canReportIssues(profile("worker", "worker"), false)).toBe(false);
    expect(canReportIssues(profile("worker", "user"), false)).toBe(false);
  });

  it("nobody without a profile can, unless they hold the admin grant", () => {
    expect(canReportIssues(null, false)).toBe(false);
    expect(canReportIssues(null, true)).toBe(true);
  });

  it("an unrecognised stored role cannot", () => {
    for (const role of ["superuser", "", "Worker", "admin"]) expect(canReportIssues(profile(role as User["role"]), false), role).toBe(false);
  });
});

describe("the rule and the app agree", () => {
  const rules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");

  it("issue creation goes through canReport(), which uses the stored role and the admin grant, not activeRole", () => {
    expect(rules).toMatch(/allow create: if signedIn\(\) && canReport\(\) && validNewIssue\(\);/);
    const fn = rules.slice(rules.indexOf("function canReport()"), rules.indexOf("// ---------- shared validation"));
    expect(fn).toContain("isAdmin()");
    expect(fn).toContain("isStudent()");
    expect(fn).not.toMatch(/activeRole/);
    // An allow-list: nothing is allowed merely because the account is not a worker.
    expect(fn).not.toContain("!isWorker()");
    const student = rules.slice(rules.indexOf("function isStudent()"), rules.indexOf("function canReport()"));
    expect(student).toContain("exists(/databases/$(database)/documents/users/$(request.auth.uid))");
    expect(student).toContain("== 'user'");
  });

  it("the student menu hides the report entry when reporting is not allowed", () => {
    const nav = readFileSync(join(process.cwd(), "components", "shell", "nav.tsx"), "utf8");
    expect(nav).toMatch(/canReport === false \? \[\]/);
  });
});
