import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { navForViewerRole, requiredRoles, homeForRole, VIEWER_ROLES } from "@/lib/viewer/nav";

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|json|mjs)$/.test(name)) out.push(full);
  }
  return out;
}

const SOURCE_DIRS = ["app", "components", "hooks", "lib", "services", "types", "data", "scripts"].map((d) => join(ROOT, d));
const files = SOURCE_DIRS.flatMap((d) => walk(d));
const read = (f: string) => readFileSync(f, "utf8");

describe("QR codes are not part of the product", () => {
  it("no source file mentions QR codes or imports a QR library", () => {
    const hits = files.filter((f) => /\bQR\b|qrcode|QrCode|qrReportUrl/i.test(read(f)));
    expect(hits.map((f) => f.replace(ROOT, ""))).toEqual([]);
  });

  it("the QR dependencies are gone", () => {
    const pkg = JSON.parse(read(join(ROOT, "package.json")));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps).filter((n) => /qrcode/i.test(n))).toEqual([]);
  });

  it("no menu offers a QR page", () => {
    for (const role of VIEWER_ROLES) {
      const labels = navForViewerRole(role).flatMap((g) => g.items.map((i) => i.label));
      expect(labels.join(" | ")).not.toMatch(/qr/i);
    }
  });
});

describe("campus places that are not part of the dataset", () => {
  it("do not appear in any application source or data file", () => {
    const banned = /gymnasium|\bgym\b|\bsbi\b|state bank of india/i;
    const hits = files.filter((f) => banned.test(read(f)));
    expect(hits.map((f) => f.replace(ROOT, ""))).toEqual([]);
  });
});

describe("Explore Mode perspectives", () => {
  const labels = (role: Parameters<typeof navForViewerRole>[0]) => navForViewerRole(role).flatMap((g) => g.items.map((i) => i.label));

  it("a worker is never offered issue reporting", () => {
    expect(labels("worker").join(" | ")).not.toMatch(/report/i);
    const hrefs = navForViewerRole("worker").flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).not.toContain("/viewer/report");
  });

  it("students report; administrators manage; both can search and follow activity", () => {
    expect(labels("student")).toEqual(expect.arrayContaining(["My issues", "Report an issue", "Notifications", "Search", "Timeline", "How it works"]));
    expect(labels("admin")).toEqual(expect.arrayContaining(["Overview", "Issues", "Analytics", "Campus map", "Workers", "Finance", "Transactions", "Locations", "Settings", "Notifications", "Search", "Timeline", "How it works"]));
    expect(labels("worker")).toEqual(expect.arrayContaining(["My work", "All issues", "Notifications", "Search", "Timeline", "How it works"]));
  });

  it("every perspective has its own home, and role-specific pages name their role", () => {
    expect(VIEWER_ROLES.map(homeForRole)).toEqual(["/viewer/student", "/viewer/worker", "/viewer/admin"]);
    expect(requiredRoles("/viewer/transactions")).toEqual(["admin"]);
    expect(requiredRoles("/viewer/student")).toEqual(["student"]);
  });
});
