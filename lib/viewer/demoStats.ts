// ============================================
// Viewer Mode figures
// ============================================
// Everything the Viewer displays is computed here from the sample dataset,
// with the same analytics, SLA, incident and insight functions the real
// admin pages use — nothing is typed in by hand.

import { Priority } from "@/types";
import { PRIORITIES } from "@/lib/constants";
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
import { DEFAULT_SLA_CONFIG } from "@/lib/intelligence/sla";
import { confirmedClusters } from "@/lib/intelligence/similarity";
import { generateInsights } from "@/lib/intelligence/insights";
import { DEMO_BUDGET_TOTAL, DEMO_TECHNICIANS, DEMO_WORKER_ID, DemoData, DemoIssue } from "./demoData";

const DAY = 86_400_000;

/** Days covered by the sample dataset (trend charts and the dataset note). */
export const DEMO_WINDOW_DAYS = 14;

export function satisfaction(issues: DemoIssue[]) {
  const ratings = issues.map((i) => i.feedback?.rating).filter((r): r is number => typeof r === "number");
  const distribution = [1, 2, 3, 4, 5].map((stars) => ({ stars, count: ratings.filter((r) => r === stars).length }));
  const average = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  return { count: ratings.length, average, distribution };
}

export function finance(issues: DemoIssue[]) {
  const claims = issues.filter((i) => i.claim).map((i) => ({ issue: i, claim: i.claim! }));
  const sum = (status: "pending" | "approved" | "rejected") =>
    claims.filter((c) => c.claim.status === status).reduce((s, c) => s + c.claim.amount, 0);
  const spent = sum("approved");
  return {
    budget: DEMO_BUDGET_TOTAL,
    spent,
    available: DEMO_BUDGET_TOTAL - spent,
    pendingAmount: sum("pending"),
    pendingCount: claims.filter((c) => c.claim.status === "pending").length,
    rejectedCount: claims.filter((c) => c.claim.status === "rejected").length,
    claims,
  };
}

export function demoStats(data: DemoData) {
  const { issues, now } = data;
  const config = DEFAULT_SLA_CONFIG;
  const sla = slaSummary(issues, config, now);
  const open = issues.filter((i) => i.status !== "Resolved");
  const from = new Date(now.getTime() - (DEMO_WINDOW_DAYS - 1) * DAY);
  const workload = workerWorkload(issues);

  return {
    total: issues.length,
    status: statusCounts(issues),
    priority: priorityCounts(issues),
    openHighPriority: open.filter((i) => i.priority === "High").length,
    categories: categoryDistribution(issues),
    resolution: resolutionStats(issues),
    resolutionByCategory: resolutionByCategory(issues),
    sla,
    overdue: sla.counts.breached,
    trend: timeSeries(issues, from, now, "day"),
    map: hotspots(issues),
    workload: DEMO_TECHNICIANS.map((t) => ({
      technician: t,
      ...(workload.find((w) => w.workerId === t.id) ?? { active: 0, resolved: 0, averageResolutionHours: null, resolvedByCategory: {} }),
    })),
    incidents: confirmedClusters(issues),
    insights: generateInsights(issues, 7, config, now),
    satisfaction: satisfaction(issues),
    finance: finance(issues),
    priorities: PRIORITIES as readonly Priority[],
  };
}

export type DemoStats = ReturnType<typeof demoStats>;

/** Slices used by the role views. */
export function studentIssues(data: DemoData) {
  return data.issues.filter((i) => i.mine);
}

export function workerTasks(data: DemoData) {
  return data.issues.filter((i) => i.assignedTo === DEMO_WORKER_ID);
}

export function openPool(data: DemoData) {
  return data.issues.filter((i) => !i.assignedTo && i.status === "Open");
}
