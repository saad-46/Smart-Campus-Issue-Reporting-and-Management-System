import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ISSUE_CATEGORIES, PRIORITIES } from "@/lib/constants";
import { matchBuilding } from "@/lib/campus";
import { buildDemoData, DEMO_BUDGET_TOTAL, DEMO_LOCATIONS, DEMO_STUDENTS, DEMO_WORKERS, demoLocation, demoTimeline, DEMO_WINDOW_DAYS } from "@/lib/viewer/demoData";
import { demoStats, openPool, studentIssues, workerTasks } from "@/lib/viewer/demoStats";
import { demoActivity, seedNotifications } from "@/lib/viewer/demoFeed";
import { hasSeenViewerGuide, markViewerGuideSeen, readViewerRole, VIEWER_GUIDE_KEY, VIEWER_ROLE_KEY, writeViewerRole } from "@/lib/viewer/guide";
import { homeForRole, isViewerPathActive, navForViewerRole, requiredRoles, roleForPath, VIEWER_PERSPECTIVES, VIEWER_ROLES } from "@/lib/viewer/nav";
import { TOUR_STEPS } from "@/lib/viewer/tour";
import { readSidebarCollapsed, SIDEBAR_KEY, writeSidebarCollapsed } from "@/lib/shellPrefs";
import { DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { searchIssues } from "@/lib/search";

const NOW = new Date(2026, 9, 4, 12, 0, 0);
const data = buildDemoData(NOW);
const stats = demoStats(data);
const ROOT = join(__dirname, "..", "..");

const memory = () => {
  const values = new Map<string, string>();
  return { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => void values.set(k, v) };
};
const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

describe("the demo dataset is large enough and believable", () => {
  it("has enough records for tables, pagination, filters and charts", () => {
    expect(data.issues.length).toBeGreaterThanOrEqual(100);
    expect(DEMO_LOCATIONS.length).toBeGreaterThanOrEqual(20);
    expect(DEMO_WORKERS.length).toBeGreaterThanOrEqual(10);
    expect(DEMO_STUDENTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(data.issues.map((i) => i.category)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(data.issues.map((i) => i.priority)).size).toBe(3);
    expect(new Set(data.issues.map((i) => i.status)).size).toBe(3);
  });

  it("never uses placeholder wording", () => {
    const text = [
      ...data.issues.flatMap((i) => [i.title, i.description, i.location, i.resolutionSummary, i.feedback?.comment ?? "", i.claim?.description ?? "", i.reporterName]),
      ...DEMO_WORKERS.flatMap((w) => [w.name, w.team]),
      ...DEMO_STUDENTS.map((s) => s.name),
    ].join(" | ");
    expect(text).not.toMatch(/lorem|ipsum|test user|test issue|fake|example|dummy|foo|bar baz|123456/i);
  });

  it("contains no emails, phone numbers, account ids, images or links", () => {
    const text = [
      ...data.issues.flatMap((i) => [i.title, i.description, i.location, i.resolutionSummary, i.feedback?.comment ?? "", i.claim?.description ?? "", i.reporterName]),
      ...DEMO_WORKERS.flatMap((w) => [w.name, w.team, ...w.skills]),
      ...DEMO_STUDENTS.flatMap((s) => [s.name, s.department]),
    ].join(" | ");
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // email
    expect(text).not.toMatch(/\+?\d[\d\s-]{8,}\d/); // phone-like digit runs
    expect(text).not.toMatch(/[A-Za-z0-9]{20,}/); // Firebase-uid-like tokens
    expect(text).not.toMatch(/data:image|https?:\/\//);
  });

  it("is internally consistent", () => {
    const ids = new Set(data.issues.map((i) => i.id));
    expect(ids.size).toBe(data.issues.length);
    expect(new Set(DEMO_LOCATIONS.map((l) => l.id)).size).toBe(DEMO_LOCATIONS.length);
    for (const l of DEMO_LOCATIONS) expect(matchBuilding(l.name)?.id).toBe(l.buildingId);
    for (const i of data.issues) {
      expect(ISSUE_CATEGORIES).toContain(i.category);
      expect(PRIORITIES).toContain(i.priority);
      expect(demoLocation(i.locationId)?.name).toBe(i.location);
      expect(matchBuilding(i.location)).toBeDefined(); // every issue is on the map
      expect(i.createdAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(i.createdAt.getTime()).toBeGreaterThan(NOW.getTime() - DEMO_WINDOW_DAYS * 86_400_000);
      if (i.startedAt) expect(i.startedAt.getTime()).toBeGreaterThanOrEqual(i.createdAt.getTime());
      if (i.resolvedAt) expect(i.resolvedAt.getTime()).toBeGreaterThanOrEqual(i.startedAt?.getTime() ?? i.createdAt.getTime());
      expect(i.status === "Resolved").toBe(!!i.resolvedAt);
      if (i.status === "In Progress") expect(i.startedAt).toBeDefined();
      if (i.status !== "Open") expect(i.assignedTo).not.toBe("");
      if (i.assignedTo) expect(DEMO_WORKERS.some((w) => w.id === i.assignedTo)).toBe(true);
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

  it("is identical on every visit for a given clock", () => {
    expect(JSON.stringify(buildDemoData(NOW))).toBe(JSON.stringify(data));
    expect(demoStats(buildDemoData(NOW))).toEqual(stats);
  });

  it("builds a timeline from the issue's own fields and never lists the future", () => {
    const resolved = data.issues.find((i) => i.id === "SC-1121")!;
    expect(demoTimeline(resolved, NOW).map((e) => e.type)).toEqual(["reported", "assigned", "started", "resolved", "claim_approved", "feedback"]);
    for (const i of data.issues) for (const e of demoTimeline(i, NOW)) expect(e.at.getTime()).toBeLessThanOrEqual(NOW.getTime());
  });
});

describe("viewer figures are computed from the dataset", () => {
  it("status, priority, category and trend counts add up", () => {
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    expect(sum(stats.status)).toBe(data.issues.length);
    expect(sum(stats.priority)).toBe(data.issues.length);
    expect(stats.categories.reduce((a, c) => a + c.value, 0)).toBe(data.issues.length);
    expect(stats.trend.reduce((a, d) => a + d.reported, 0)).toBe(data.issues.length);
    expect(stats.map.unplaced).toBe(0);
    expect(stats.heatmap.grid.flat().reduce((a, b) => a + b, 0)).toBe(data.issues.length);
    expect(stats.workload.reduce((a, w) => a + w.active + w.resolved, 0)).toBe(data.issues.filter((i) => i.assignedTo).length);
  });

  it("covers every deadline state so SLA tracking is demonstrated honestly", () => {
    for (const state of ["on-track", "approaching", "breached", "met", "missed"] as const) expect(stats.sla.counts[state]).toBeGreaterThan(0);
    expect(stats.slaCompliance).toBeGreaterThan(50);
    expect(stats.slaCompliance).toBeLessThan(100);
  });

  it("satisfaction and finance are computed from ratings and claims", () => {
    const ratings = data.issues.flatMap((i) => (i.feedback ? [i.feedback.rating] : []));
    expect(stats.satisfaction.count).toBe(ratings.length);
    expect(stats.satisfaction.average).toBe(Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10);
    const approved = data.issues.filter((i) => i.claim?.status === "approved");
    expect(stats.finance.spent).toBe(approved.reduce((s, i) => s + i.claim!.amount, 0));
    expect(stats.finance.available).toBe(DEMO_BUDGET_TOTAL - stats.finance.spent);
    expect(stats.finance.transactions).toHaveLength(approved.length);
    expect(stats.finance.pendingCount).toBeGreaterThan(0);
    expect(stats.finance.spendByCategory.reduce((s, c) => s + c.value, 0)).toBe(stats.finance.spent);
  });

  it("role slices, incidents and risk exist for every perspective", () => {
    expect(studentIssues(data).length).toBeGreaterThanOrEqual(5);
    expect(studentIssues(data).every((i) => i.mine)).toBe(true);
    expect(workerTasks(data).length).toBeGreaterThan(0);
    expect(openPool(data).every((i) => !i.assignedTo && i.status === "Open")).toBe(true);
    expect(stats.incidents.length).toBeGreaterThan(0);
    expect(stats.risk.sufficient).toBe(true);
    expect(stats.insights.length).toBeGreaterThan(0);
  });

  it("recomputes when the deadline targets change", () => {
    const strict = demoStats(data, { hours: { High: 2, Medium: 6, Low: 12 }, isDefault: false });
    expect(strict.sla.counts.breached).toBeGreaterThan(stats.sla.counts.breached);
    expect(demoStats(data, DEFAULT_SLA_CONFIG)).toEqual(stats);
  });

  it("search finds issues by id, wording and synonym", () => {
    expect(searchIssues(data.issues, "SC-1140")[0].issue.id).toBe("SC-1140");
    expect(searchIssues(data.issues, "projector").length).toBeGreaterThan(1);
    expect(searchIssues(data.issues, "wifi").some((h) => h.issue.category === "IT")).toBe(true);
    expect(searchIssues(data.issues, "zzzzqqqq")).toHaveLength(0);
  });
});

describe("notifications and activity come from the issues", () => {
  it("each perspective has its own, newest first, with some unread", () => {
    for (const role of VIEWER_ROLES) {
      const list = seedNotifications(data, role);
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((n) => !n.read)).toBe(true);
      for (let i = 1; i < list.length; i++) expect(list[i - 1].at.getTime()).toBeGreaterThanOrEqual(list[i].at.getTime());
      for (const n of list) if (n.issueId) expect(data.issues.some((i) => i.id === n.issueId)).toBe(true);
    }
  });

  it("the campus timeline lists recorded events newest first", () => {
    const feed = demoActivity(data);
    expect(feed.length).toBeGreaterThan(100);
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1].at.getTime()).toBeGreaterThanOrEqual(feed[i].at.getTime());
  });
});

describe("viewer preferences", () => {
  it("remembers the tour once seen, and never throws when storage is blocked", () => {
    const store = memory();
    expect(hasSeenViewerGuide(store)).toBe(false);
    markViewerGuideSeen(store);
    expect(store.getItem(VIEWER_GUIDE_KEY)).toBe("1");
    expect(hasSeenViewerGuide(store)).toBe(true);
    expect(hasSeenViewerGuide(blocked)).toBe(false);
    expect(() => markViewerGuideSeen(blocked)).not.toThrow();
    expect(hasSeenViewerGuide(null)).toBe(false);
  });

  it("remembers the perspective and rejects anything else", () => {
    const store = memory();
    expect(readViewerRole(store)).toBeNull();
    writeViewerRole("worker", store);
    expect(store.getItem(VIEWER_ROLE_KEY)).toBe("worker");
    expect(readViewerRole(store)).toBe("worker");
    store.setItem(VIEWER_ROLE_KEY, "superuser");
    expect(readViewerRole(store)).toBeNull();
    expect(readViewerRole(blocked)).toBeNull();
    expect(() => writeViewerRole("admin", blocked)).not.toThrow();
  });

  it("remembers the sidebar state", () => {
    const store = memory();
    expect(readSidebarCollapsed(store)).toBe(false);
    writeSidebarCollapsed(true, store);
    expect(store.getItem(SIDEBAR_KEY)).toBe("1");
    expect(readSidebarCollapsed(store)).toBe(true);
    expect(readSidebarCollapsed(blocked)).toBe(false);
    expect(() => writeSidebarCollapsed(true, blocked)).not.toThrow();
  });
});

describe("viewer navigation and perspectives", () => {
  const pageExists = (href: string) => {
    const path = href.split(/[?#]/)[0].replace(/^\//, "");
    return existsSync(join(ROOT, "app", ...path.split("/"), "page.tsx"));
  };

  it("offers three perspectives, each with its own menu of real public pages", () => {
    expect(VIEWER_PERSPECTIVES.map((p) => p.label)).toEqual(["Student", "Worker", "Admin"]);
    for (const role of VIEWER_ROLES) {
      const items = navForViewerRole(role).flatMap((g) => g.items);
      expect(items.length).toBeGreaterThanOrEqual(5);
      expect(items.some((i) => i.href === homeForRole(role))).toBe(true);
      for (const item of items) {
        expect(item.href === "/viewer" || item.href.startsWith("/viewer/")).toBe(true);
        expect(pageExists(item.href), `${item.href} has a page`).toBe(true);
      }
      expect(items.map((i) => i.label.toLowerCase()).join(" ")).not.toMatch(/account|sign out|password/);
    }
  });

  it("the admin menu mirrors the signed-in admin menu", () => {
    const admin = navForViewerRole("admin").flatMap((g) => g.items.map((i) => i.label));
    for (const label of ["Overview", "Issues", "Analytics", "Campus map", "Workers", "Finance", "Locations & QR", "Settings"]) expect(admin).toContain(label);
  });

  it("deep links to role-specific pages switch to that perspective", () => {
    expect(roleForPath("/viewer/finance", "student")).toBe("admin");
    expect(roleForPath("/viewer/worker", "admin")).toBe("worker");
    expect(roleForPath("/viewer/report", "admin")).toBe("student");
    expect(roleForPath("/viewer/report", "worker")).toBe("worker");
    expect(roleForPath("/viewer/issues/SC-1140", "student")).toBe("student");
    expect(requiredRoles("/viewer/analytics")).toEqual(["admin"]);
    expect(requiredRoles("/viewer/notifications")).toBeNull();
  });

  it("marks the current section", () => {
    expect(isViewerPathActive("/viewer", "/viewer")).toBe(true);
    expect(isViewerPathActive("/viewer", "/viewer/admin")).toBe(false);
    expect(isViewerPathActive("/viewer/issues", "/viewer/issues/SC-1140")).toBe(true);
    expect(isViewerPathActive("/viewer/admin", "/viewer/analytics")).toBe(false);
  });
});

describe("the guided tour points only at things that exist", () => {
  const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
  // Where each route's markup lives.
  const pageFile = (path: string): string => {
    const clean = path.split(/[?#]/)[0];
    if (/^\/viewer\/issues\/[^/]+$/.test(clean)) return "app/viewer/issues/[id]/page.tsx";
    return `app${clean}/page.tsx`;
  };
  const shellSources = ["components/viewer/ViewerShell.tsx", "components/viewer/ViewerNotificationBell.tsx", "components/shell/ShellFrame.tsx", "lib/viewer/nav.ts"].map(read).join("\n");

  it("has a reasonable number of unique steps that begin and end centred", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    expect(TOUR_STEPS[0].target).toBeUndefined();
    expect(TOUR_STEPS.at(-1)!.target).toBeUndefined();
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.body.length).toBeGreaterThan(20);
    }
  });

  it.each(TOUR_STEPS.map((s) => [s.id, s] as const))("step %s opens a real page and its anchor exists", (_id, step) => {
    expect(step.path.startsWith("/viewer")).toBe(true);
    expect(existsSync(join(ROOT, pageFile(step.path))), `${step.path} has a page`).toBe(true);
    if (step.role) {
      const needed = requiredRoles(step.path.split(/[?#]/)[0]);
      if (needed) expect(needed).toContain(step.role);
    }
    if (step.learnMore) expect(existsSync(join(ROOT, pageFile(step.learnMore.href)))).toBe(true);
    if (!step.target) return;
    const anchor = new RegExp(`(data-tour=["'{]\\s*["']?${step.target}["']?|tour: ["']${step.target}["']|tour="${step.target}")`);
    const inPage = anchor.test(read(pageFile(step.path)));
    const inShell = anchor.test(shellSources);
    expect(inPage || inShell, `anchor "${step.target}" exists for ${step.path}`).toBe(true);
  });
});

describe("viewer code cannot reach private data, roles or the network", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const viewerFiles = [...files(join(ROOT, "app", "viewer")), ...files(join(ROOT, "components", "viewer")), ...files(join(ROOT, "lib", "viewer"))];

  it("finds the viewer sources", () => {
    expect(viewerFiles.length).toBeGreaterThanOrEqual(30);
  });

  it.each([
    ["the Firebase SDK", /from ["']firebase\//],
    ["the Firebase app", /@\/lib\/firebase["']/],
    ["Firestore data access", /@\/lib\/(firestore|firestoreRest|finance|notifications|feedback|locations|auth|timeline|listeners)["']/],
    ["auth or role state", /useAuth|AuthProvider|useAuthContext|switchRole|activeRole|isAdmin|role\s*[:=]\s*["']admin["']\s*[,}]\s*\/\/ real/],
    ["live data hooks", /useSlaConfig|useNotifications|useCampusLocations|@\/hooks\/useAuth/],
    ["network calls", /\bfetch\s*\(|XMLHttpRequest|new WebSocket|sendBeacon|EventSource/],
  ])("never imports or uses %s", (_name, pattern) => {
    for (const file of viewerFiles) {
      expect({ file, matches: pattern.test(readFileSync(file, "utf8")) }).toEqual({ file, matches: false });
    }
  });

  it("transitively imports nothing that loads Firebase", () => {
    const resolve = (from: string, spec: string): string | null => {
      const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? join(from, "..", spec) : null;
      if (!base) return null;
      for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
      return null;
    };
    const seen = new Set<string>();
    const queue = [...viewerFiles, join(ROOT, "components", "shell", "ShellFrame.tsx")];
    const offenders: string[] = [];
    while (queue.length) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      const source = readFileSync(file, "utf8");
      for (const m of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
        const spec = m[1];
        if (/^firebase(\/|$)/.test(spec) || /@\/lib\/(firebase|firestore|firestoreRest)$/.test(spec) || /@\/hooks\/useAuth$/.test(spec) || /AuthProvider$/.test(spec)) offenders.push(`${file} -> ${spec}`);
        const next = resolve(file, spec);
        if (next) queue.push(next);
      }
    }
    expect(offenders).toEqual([]);
    expect(seen.size).toBeGreaterThan(60); // the walk really followed the imports
  });

  it("is outside the route group that starts Firebase Auth", () => {
    expect(existsSync(join(ROOT, "app", "viewer", "layout.tsx"))).toBe(true);
    expect(readFileSync(join(ROOT, "app", "layout.tsx"), "utf8")).not.toMatch(/AuthProvider/);
    expect(readFileSync(join(ROOT, "app", "(app)", "layout.tsx"), "utf8")).toMatch(/AuthProvider/);
  });

  it("only stores preferences in the browser, and only through the viewer preferences module", () => {
    for (const file of viewerFiles) {
      const source = readFileSync(file, "utf8");
      if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(source)) expect(file).toMatch(/lib[\\/]viewer[\\/]guide\.ts$/);
    }
  });
});
