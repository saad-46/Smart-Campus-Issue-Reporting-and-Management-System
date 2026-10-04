import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ISSUE_CATEGORIES, PRIORITIES } from "@/lib/constants";
import { matchBuilding } from "@/lib/campus";
import { buildDemoData, DEMO_BUDGET_TOTAL, DEMO_TECHNICIANS, demoTimeline } from "@/lib/viewer/demoData";
import { demoStats, DEMO_WINDOW_DAYS, openPool, studentIssues, workerTasks } from "@/lib/viewer/demoStats";
import { hasSeenViewerGuide, markViewerGuideSeen, VIEWER_GUIDE_KEY } from "@/lib/viewer/guide";
import { isViewerPathActive, VIEWER_NAV, VIEWER_PERSPECTIVES } from "@/lib/viewer/nav";

const NOW = new Date(2026, 9, 4, 12, 0, 0);
const data = buildDemoData(NOW);
const stats = demoStats(data);

describe("viewer sample dataset is sanitized", () => {
  // Every human-readable field (timestamps are Dates, not text).
  const text = [
    ...data.issues.flatMap((i) => [i.title, i.description, i.location, i.resolutionSummary, i.feedback?.comment ?? "", i.claim?.description ?? ""]),
    ...DEMO_TECHNICIANS.flatMap((t) => [t.label, t.speciality]),
  ].join(" | ");

  it("contains no emails, phone numbers, account ids, images or links", () => {
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // email
    expect(text).not.toMatch(/\+?\d[\d\s-]{8,}\d/); // phone-like digit runs
    expect(text).not.toMatch(/[A-Za-z0-9]{20,}/); // Firebase-uid-like tokens
    expect(text).not.toMatch(/data:image|https?:\/\//);
  });

  it("uses anonymous sample staff and a sample student flag instead of identities", () => {
    for (const t of DEMO_TECHNICIANS) expect(t.label).toMatch(/^Technician [A-Z]$/);
    for (const issue of data.issues) {
      expect(issue).not.toHaveProperty("createdBy");
      expect(issue).not.toHaveProperty("createdByName");
      expect(issue).not.toHaveProperty("receiptUrl");
      expect(issue).not.toHaveProperty("imageUrls");
      expect(issue.assignedTo === "" || DEMO_TECHNICIANS.some((t) => t.id === issue.assignedTo)).toBe(true);
    }
  });

  it("is internally consistent", () => {
    const ids = new Set(data.issues.map((i) => i.id));
    expect(ids.size).toBe(data.issues.length);
    for (const i of data.issues) {
      expect(ISSUE_CATEGORIES).toContain(i.category);
      expect(PRIORITIES).toContain(i.priority);
      expect(matchBuilding(i.location)).toBeDefined(); // every issue is on the map
      expect(i.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(i.createdAt.getTime()).toBeGreaterThan(NOW.getTime() - DEMO_WINDOW_DAYS * 86_400_000);
      if (i.startedAt) expect(i.startedAt.getTime()).toBeGreaterThanOrEqual(i.createdAt.getTime());
      if (i.resolvedAt) expect(i.resolvedAt.getTime()).toBeGreaterThanOrEqual(i.startedAt?.getTime() ?? i.createdAt.getTime());
      expect(i.status === "Resolved").toBe(!!i.resolvedAt);
      if (i.status !== "Open") expect(i.assignedTo).not.toBe("");
      if (i.duplicateOf) expect(ids.has(i.duplicateOf)).toBe(true);
      if (i.claim) {
        expect(i.status).toBe("Resolved");
        expect(i.claim.description.length).toBeGreaterThan(0);
        expect(i.claim.description.length).toBeLessThanOrEqual(500);
      }
      if (i.feedback) {
        expect(i.status).toBe("Resolved");
        expect(i.feedback.rating).toBeGreaterThanOrEqual(1);
        expect(i.feedback.rating).toBeLessThanOrEqual(5);
      }
    }
  });

  it("builds a timeline from the issue's own fields", () => {
    const resolved = data.issues.find((i) => i.id === "v12")!;
    expect(demoTimeline(resolved).map((e) => e.type)).toEqual(["reported", "assigned", "started", "resolved", "claim_approved", "feedback"]);
    const fresh = data.issues.find((i) => i.id === "v05")!;
    expect(demoTimeline(fresh).map((e) => e.type)).toEqual(["reported"]);
  });
});

describe("viewer figures come from the dataset", () => {
  it("status, priority and category counts add up", () => {
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    expect(sum(stats.status)).toBe(data.issues.length);
    expect(sum(stats.priority)).toBe(data.issues.length);
    expect(stats.categories.reduce((a, c) => a + c.value, 0)).toBe(data.issues.length);
    expect(stats.trend.reduce((a, d) => a + d.reported, 0)).toBe(data.issues.length);
    expect(stats.map.unplaced).toBe(0);
  });

  it("covers every deadline state so SLA tracking is demonstrated honestly", () => {
    for (const state of ["on-track", "approaching", "breached", "met", "missed"] as const) {
      expect(stats.sla.counts[state]).toBeGreaterThan(0);
    }
  });

  it("satisfaction and finance are computed from ratings and claims", () => {
    const ratings = data.issues.flatMap((i) => (i.feedback ? [i.feedback.rating] : []));
    expect(stats.satisfaction.count).toBe(ratings.length);
    expect(stats.satisfaction.average).toBe(Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10);
    const approved = data.issues.filter((i) => i.claim?.status === "approved").reduce((s, i) => s + i.claim!.amount, 0);
    expect(stats.finance.spent).toBe(approved);
    expect(stats.finance.available).toBe(DEMO_BUDGET_TOTAL - approved);
  });

  it("role slices match their definitions", () => {
    expect(studentIssues(data).every((i) => i.mine)).toBe(true);
    expect(workerTasks(data).length).toBeGreaterThan(0);
    expect(openPool(data).every((i) => !i.assignedTo && i.status === "Open")).toBe(true);
    expect(stats.incidents.length).toBeGreaterThan(0);
  });

  it("is deterministic for a given clock", () => {
    expect(demoStats(buildDemoData(NOW))).toEqual(stats);
  });
});

describe("viewer guide preference", () => {
  const memory = () => {
    const values = new Map<string, string>();
    return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v) };
  };

  it("is unset at first and remembered once seen", () => {
    const store = memory();
    expect(hasSeenViewerGuide(store)).toBe(false);
    markViewerGuideSeen(store);
    expect(store.getItem(VIEWER_GUIDE_KEY)).toBe("1");
    expect(hasSeenViewerGuide(store)).toBe(true);
  });

  it("never throws when storage is blocked", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasSeenViewerGuide(blocked)).toBe(false);
    expect(() => markViewerGuideSeen(blocked)).not.toThrow();
    expect(hasSeenViewerGuide(null)).toBe(false);
  });
});

describe("viewer navigation", () => {
  const items = VIEWER_NAV.flatMap((g) => g.items);

  it("only links to public /viewer pages", () => {
    for (const item of items) expect(item.href === "/viewer" || item.href.startsWith("/viewer/")).toBe(true);
    expect(items.map((i) => i.label.toLowerCase()).join(" ")).not.toMatch(/account|payment|notification|settings|worker access|sign out/);
    expect(VIEWER_PERSPECTIVES.map((p) => p.label)).toEqual(["Student", "Worker", "Admin"]);
  });

  it("marks the current section", () => {
    expect(isViewerPathActive("/viewer", "/viewer")).toBe(true);
    expect(isViewerPathActive("/viewer", "/viewer/admin")).toBe(false);
    expect(isViewerPathActive("/viewer/admin", "/viewer/admin")).toBe(true);
    expect(isViewerPathActive("/viewer/admin", "/viewer/analytics")).toBe(false);
  });
});

describe("viewer code cannot reach private data or roles", () => {
  const ROOT = join(__dirname, "..", "..");
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const viewerFiles = [...files(join(ROOT, "app", "viewer")), ...files(join(ROOT, "components", "viewer")), ...files(join(ROOT, "lib", "viewer"))];

  it("finds the viewer sources", () => {
    expect(viewerFiles.length).toBeGreaterThanOrEqual(12);
  });

  it.each([
    ["the Firebase SDK", /from ["']firebase\//],
    ["the Firebase app", /@\/lib\/firebase["']/],
    ["Firestore data access", /@\/lib\/(firestore|firestoreRest|finance|notifications|feedback|locations|auth)["']/],
    ["auth or role state", /useAuth|AuthProvider|useAuthContext|switchRole|activeRole|isAdmin|role\s*[:=]\s*["']admin/],
    ["live data hooks", /useSlaConfig|useNotifications|useCampusLocations/],
  ])("never imports or uses %s", (_name, pattern) => {
    for (const file of viewerFiles) {
      expect({ file, matches: pattern.test(readFileSync(file, "utf8")) }).toEqual({ file, matches: false });
    }
  });

  it("only stores the guide preference in the browser", () => {
    for (const file of viewerFiles) {
      const source = readFileSync(file, "utf8");
      if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source)) expect(file).toMatch(/lib[\\/]viewer[\\/]guide\.ts$/);
    }
  });
});
