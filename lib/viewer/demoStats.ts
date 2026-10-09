// ============================================
// Viewer Mode figures
// ============================================
// Everything the Viewer displays is computed here from the demo dataset,
// with the same analytics, SLA, incident, risk and insight functions the
// real admin pages use. No figure is typed in by hand.

import { IssueSummary, Priority, SlaConfig } from "@/types";
import { DEPARTMENTS, PRIORITIES, departmentFor } from "@/lib/constants";
import {
  categoryDistribution,
  hotspots,
  priorityCounts,
  resolutionByCategory,
  resolutionStats,
  slaSummary,
  statusCounts,
  timeSeries,
  workerWorkload,
} from "@/lib/intelligence/analytics";
import { DEFAULT_SLA_CONFIG, computeSla } from "@/lib/intelligence/sla";
import { confirmedClusters, suggestClusters } from "@/lib/intelligence/similarity";
import { generateInsights } from "@/lib/intelligence/insights";
import { maintenanceRisk } from "@/lib/intelligence/maintenance";
import { payoutNote } from "@/lib/claims";
import { DEMO_BUDGET_TOTAL, DEMO_LOCATIONS, DEMO_PERSONA, DEMO_WINDOW_DAYS, DEMO_WORKERS, DemoData, DemoIssue, DemoLocation, DemoWorker } from "./demoData";

export { DEMO_WINDOW_DAYS };

const DAY = 86_400_000;
const HOUR = 3_600_000;

/** campusLocations id → building id / name, as the real pages build from Firestore. */
export const LOCATION_BUILDINGS = new Map(DEMO_LOCATIONS.map((l) => [l.id, l.buildingId]));
export const LOCATION_NAMES = new Map(DEMO_LOCATIONS.map((l) => [l.id, l.name]));

export function satisfaction(issues: DemoIssue[]) {
  const ratings = issues.map((i) => i.feedback?.rating).filter((r): r is number => typeof r === "number");
  const distribution = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: ratings.filter((r) => r === stars).length }));
  const average = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  return { count: ratings.length, average, distribution };
}

export interface DemoTransaction {
  id: string;
  issueId: string;
  workerId: string;
  amount: number;
  note: string;
  at: Date;
}

export function finance(issues: DemoIssue[], budget: number = DEMO_BUDGET_TOTAL) {
  const claims = issues.filter((i) => i.claim).map((i) => ({ issue: i, claim: i.claim! }));
  const sum = (status: "pending" | "approved" | "rejected") =>
    claims.filter((c) => c.claim.status === status).reduce((s, c) => s + c.claim.amount, 0);
  const spent = sum("approved");
  const transactions: DemoTransaction[] = claims
    .filter((c) => c.claim.status === "approved")
    .map((c) => ({
      id: `TX-${c.issue.id.replace("SC-", "")}`,
      issueId: c.issue.id,
      workerId: c.issue.assignedTo,
      amount: c.claim.amount,
      note: payoutNote(c.issue.title, c.claim.description),
      at: c.claim.decidedAt ?? new Date((c.issue.resolvedAt ?? c.issue.createdAt).getTime() + 2 * HOUR),
    }))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  const spendByCategory = new Map<string, number>();
  for (const c of claims) if (c.claim.status === "approved") spendByCategory.set(c.issue.category, (spendByCategory.get(c.issue.category) ?? 0) + c.claim.amount);
  return {
    budget,
    spent,
    available: budget - spent,
    pendingAmount: sum("pending"),
    pendingCount: claims.filter((c) => c.claim.status === "pending").length,
    rejectedCount: claims.filter((c) => c.claim.status === "rejected").length,
    claims,
    transactions,
    spendByCategory: [...spendByCategory.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}

/** Share of resolved issues that met their target, 0–100 (null with nothing resolved). */
export function slaCompliance(counts: { met: number; missed: number }): number | null {
  const done = counts.met + counts.missed;
  return done ? Math.round((counts.met / done) * 1000) / 10 : null;
}

/** Percentage change, or null when there is nothing to compare against. */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function inWindow<T extends { createdAt: Date }>(issues: T[], from: number, to: number): T[] {
  return issues.filter((i) => i.createdAt.getTime() >= from && i.createdAt.getTime() < to);
}

/** Reports by weekday and four-hour block (when do problems get reported?). */
export function reportingHeatmap(issues: IssueSummary[]) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const blocks = ["12am", "4am", "8am", "12pm", "4pm", "8pm"];
  const grid = days.map(() => blocks.map(() => 0));
  for (const i of issues) grid[(i.createdAt.getDay() + 6) % 7][Math.floor(i.createdAt.getHours() / 4)]++;
  return { days, blocks, grid, max: Math.max(0, ...grid.flat()) };
}

export function departmentStats(issues: DemoIssue[], config: SlaConfig, now: Date) {
  return DEPARTMENTS.map((name) => {
    const list = issues.filter((i) => departmentFor(i.category) === name);
    const sla = slaSummary(list, config, now).counts;
    return {
      name,
      total: list.length,
      open: list.filter((i) => i.status !== "Resolved").length,
      averageHours: resolutionStats(list).averageHours,
      compliance: slaCompliance(sla),
    };
  })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** What simulated actions can change besides the issues: the team, the budget and the location list. */
export interface DemoStatsExtras {
  workers?: DemoWorker[];
  budget?: number;
  locations?: DemoLocation[];
}

export function demoStats(data: DemoData, config: SlaConfig = DEFAULT_SLA_CONFIG, extras: DemoStatsExtras = {}) {
  const { issues, now } = data;
  const team = extras.workers ?? DEMO_WORKERS;
  const places = extras.locations ?? DEMO_LOCATIONS;
  const locationBuildings = extras.locations ? new Map(places.map((l) => [l.id, l.buildingId])) : LOCATION_BUILDINGS;
  const locationNames = extras.locations ? new Map(places.map((l) => [l.id, l.name])) : LOCATION_NAMES;
  const sla = slaSummary(issues, config, now);
  const open = issues.filter((i) => i.status !== "Resolved");
  const from = new Date(now.getTime() - (DEMO_WINDOW_DAYS - 1) * DAY);
  const workload = workerWorkload(issues);
  const trend = timeSeries(issues, from, now, "day");

  // This week against the week before, for the KPI trends.
  const t = now.getTime();
  const thisWeek = inWindow(issues, t - 7 * DAY, t + 1);
  const lastWeek = inWindow(issues, t - 14 * DAY, t - 7 * DAY);
  const resolvedIn = (a: number, b: number) => issues.filter((i) => i.resolvedAt && i.resolvedAt.getTime() >= a && i.resolvedAt.getTime() < b);
  const resolvedThis = resolvedIn(t - 7 * DAY, t + 1);
  const resolvedLast = resolvedIn(t - 14 * DAY, t - 7 * DAY);

  // Open backlog at the end of each of the last 14 days.
  const backlog = Array.from({ length: 14 }, (_, k) => {
    const end = t - (13 - k) * DAY;
    return issues.filter((i) => i.createdAt.getTime() <= end && (!i.resolvedAt || i.resolvedAt.getTime() > end)).length;
  });

  const ratingsByWorker = new Map<string, number[]>();
  for (const i of issues) if (i.feedback && i.assignedTo) ratingsByWorker.set(i.assignedTo, [...(ratingsByWorker.get(i.assignedTo) ?? []), i.feedback.rating]);
  const fin = finance(issues, extras.budget);

  return {
    total: issues.length,
    status: statusCounts(issues),
    priority: priorityCounts(issues),
    openCount: open.length,
    openHighPriority: open.filter((i) => i.priority === "High").length,
    unassigned: open.filter((i) => !i.assignedTo).length,
    categories: categoryDistribution(issues),
    resolution: resolutionStats(issues),
    resolutionByCategory: resolutionByCategory(issues),
    sla,
    slaCompliance: slaCompliance(sla.counts),
    overdue: sla.counts.breached,
    trend,
    week: {
      reported: thisWeek.length,
      reportedChange: changePct(thisWeek.length, lastWeek.length),
      resolved: resolvedThis.length,
      resolvedChange: changePct(resolvedThis.length, resolvedLast.length),
      averageHours: resolutionStats(resolvedThis).averageHours,
      averageHoursChange: (() => {
        const a = resolutionStats(resolvedThis).averageHours;
        const b = resolutionStats(resolvedLast).averageHours;
        return a !== null && b !== null ? changePct(a, b) : null;
      })(),
    },
    spark: {
      reported: trend.slice(-14).map((d) => d.reported),
      resolved: trend.slice(-14).map((d) => d.resolved),
      backlog,
    },
    locationBuildings,
    map: hotspots(issues, locationBuildings),
    workload: team.map((w) => {
      const load = workload.find((l) => l.workerId === w.id) ?? { active: 0, resolved: 0, averageResolutionHours: null, resolvedByCategory: {} };
      const ratings = ratingsByWorker.get(w.id) ?? [];
      return {
        worker: w,
        ...load,
        rating: ratings.length >= 2 ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
        ratingCount: ratings.length,
        earnings: fin.transactions.filter((x) => x.workerId === w.id).reduce((s, x) => s + x.amount, 0),
      };
    }),
    rawWorkload: workload,
    incidents: confirmedClusters(issues),
    suggestedIncidents: suggestClusters(issues),
    insights: generateInsights(issues, 14, config, now, locationBuildings),
    risk: maintenanceRisk(issues, now, locationBuildings, locationNames),
    satisfaction: satisfaction(issues),
    finance: fin,
    departments: departmentStats(issues, config, now),
    heatmap: reportingHeatmap(issues),
    priorities: PRIORITIES as readonly Priority[],
  };
}

export type DemoStats = ReturnType<typeof demoStats>;

/** Slices used by the role views. */
export function studentIssues(data: DemoData) {
  return data.issues.filter((i) => i.mine);
}

export function workerTasks(data: DemoData, workerId: string = DEMO_PERSONA.worker.id) {
  return data.issues.filter((i) => i.assignedTo === workerId);
}

export function openPool(data: DemoData) {
  return data.issues.filter((i) => !i.assignedTo && i.status === "Open");
}

/** Newest first, with unresolved work ahead of resolved work at equal age. */
export function byNewest<T extends { createdAt: Date }>(issues: T[]): T[] {
  return [...issues].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Most urgent first: overdue, then due soon, then by time left. */
export function byUrgency(issues: DemoIssue[], config: SlaConfig, now: Date): DemoIssue[] {
  const rank = { breached: 0, approaching: 1, "on-track": 2, missed: 3, met: 4 } as const;
  return [...issues].sort((a, b) => {
    const sa = computeSla(a, config, now);
    const sb = computeSla(b, config, now);
    return rank[sa.state] - rank[sb.state] || sa.remainingMs - sb.remainingMs || b.createdAt.getTime() - a.createdAt.getTime();
  });
}
