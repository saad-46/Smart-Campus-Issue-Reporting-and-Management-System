import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { navForViewerRole } from "@/lib/viewer/nav";

const ROOT = process.cwd();

// The signed-in navigation is JSX (components/shell/nav.tsx), so it is read as
// source here: the unit environment has no DOM or JSX transform. The /admin
// block is the part between the `role === "admin"` branch and the worker one.
const source = readFileSync(join(ROOT, "components", "shell", "nav.tsx"), "utf8");
const adminBlock = source.slice(source.indexOf('role === "admin"'), source.indexOf('role === "worker"'));
const items = [...adminBlock.matchAll(/label: "([^"]+)", href: "([^"]+)"/g)].map((m) => ({ label: m[1], href: m[2] }));

describe("administrator navigation", () => {
  it("has a Transactions entry that leads to a real page, apart from Finance", () => {
    expect(items.find((i) => i.label === "Transactions")?.href).toBe("/admin/transactions");
    expect(existsSync(join(ROOT, "app", "(app)", "admin", "transactions", "page.tsx"))).toBe(true);
    // Only one entry may be a path prefix of the Transactions page, or two items would both look active.
    expect(items.filter((i) => i.href !== "/admin" && "/admin/transactions".startsWith(`${i.href}/`))).toEqual([]);
  });

  it("points every entry at a page that exists, with no duplicate destination or label", () => {
    expect(items.length).toBeGreaterThanOrEqual(8);
    for (const i of items) expect(existsSync(join(ROOT, "app", "(app)", ...i.href.split("/").filter(Boolean), "page.tsx")), `${i.href} has a page`).toBe(true);
    expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
    expect(new Set(items.map((i) => i.label)).size).toBe(items.length);
  });

  it("is mirrored in Explore Mode", () => {
    expect(navForViewerRole("admin").flatMap((g) => g.items.map((i) => i.label))).toContain("Transactions");
    expect(existsSync(join(ROOT, "app", "viewer", "transactions", "page.tsx"))).toBe(true);
  });

  it("keeps /admin pages out of the worker and student menus", () => {
    const rest = source.slice(source.indexOf('role === "worker"'));
    expect(rest).not.toContain("/admin");
  });
});
