// ============================================
// Analytics aggregations
// ============================================
// Pure functions over a bounded list of IssueSummary projections. Callers
// fetch at most QUERY_LIMITS.analytics issues for the selected range and
// say so in the UI when the cap was reached.

import { IssueStatus, IssueSummary, Priority, SlaConfig, SlaState } from "@/types";
import { ISSUE_STATUSES, PRIORITIES, departmentFor } from "@/lib/constants";
import { BUILDINGS, buildingForIssue } from "@/lib/campus";
import { computeSla } from "./sla";

const HOUR = 3_600_000;
const DAY = 86_400_000;

export interface AnalyticsFilters {
  category?: string;
  status?: IssueStatus;
  priority?: Priority;
  buildingId?: string;
  workerId?: string;
  department?: string;
}

export function applyFilters(
  issues: IssueSummary[],
  filters: AnalyticsFilters,
  locationBuildings: Map<string, string> = new Map()
): IssueSummary[] {
  return issues.filter((i) => {
    if (filters.category && i.category !== filters.category) return false;
    if (filters.status && i.status !== filters.status) return false;
    if (filters.priority && i.priority !== filters.priority) return false;
    if (filters.workerId && i.assignedTo !== filters.workerId) return false;
    if (filters.department && departmentFor(i.category) !== filters.department) return false;
    if (filters.buildingId && buildingForIssue(i, locationBuildings)?.id !== filters.buildingId) return false;
    return true;
  });
}

export function countBy<T extends string>(issues: IssueSummary[], key: (i: IssueSummary) => T): Map<T, number> {
  const counts = new Map<T, number>();
  for (const issue of issues) counts.set(key(issue), (counts.get(key(issue)) ?? 0) + 1);
  return counts;
}

export function statusCounts(issues: IssueSummary[]): Record<IssueStatus, number> {
  const counts = countBy(issues, (i) => i.status);
  return Object.fromEntries(ISSUE_STATUSES.map((s) => [s, counts.get(s) ?? 0])) as Record<IssueStatus, number>;
}

export function priorityCounts(issues: IssueSummary[]): Record<Priority, number> {
  const counts = countBy(issues, (i) => i.priority);
  return Object.fromEntries(PRIORITIES.map((p) => [p, counts.get(p) ?? 0])) as Record<Priority, number>;
}

/** Categories by count, largest first. */
export function categoryDistribution(issues: IssueSummary[]): { name: string; value: number }[] {
  return [...countBy(issues, (i) => i.category).entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export type Granularity = "day" | "week" | "month";

function bucketStart(date: Date, granularity: Granularity): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (granularity === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (granularity === "month") d.setDate(1);
  return d;
}

function nextBucket(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  if (granularity === "day") d.setDate(d.getDate() + 1);
  else if (granularity === "week") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

function bucketLabel(date: Date, granularity: Granularity): string {
  return granularity === "month"
    ? date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" })
    : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Issues reported per day/week/month across [from, to], including empty buckets. */
export function timeSeries(
  issues: IssueSummary[],
  from: Date,
  to: Date,
  granularity: Granularity
): { label: string; reported: number; resolved: number }[] {
  const buckets: { start: number; label: string; reported: number; resolved: number }[] = [];
  for (let d = bucketStart(from, granularity); d.getTime() <= to.getTime() && buckets.length < 400; d = nextBucket(d, granularity)) {
    buckets.push({ start: d.getTime(), label: bucketLabel(d, granularity), reported: 0, resolved: 0 });
  }
  const indexFor = (date: Date) => {
    const t = bucketStart(date, granularity).getTime();
    return buckets.findIndex((b) => b.start === t);
  };
  for (const issue of issues) {
    const r = indexFor(issue.createdAt);
    if (r >= 0) buckets[r].reported++;
    if (issue.resolvedAt) {
      const s = indexFor(issue.resolvedAt);
      if (s >= 0) buckets[s].resolved++;
    }
  }
  return buckets.map(({ label, reported, resolved }) => ({ label, reported, resolved }));
}

export function granularityFor(from: Date, to: Date): Granularity {
  const days = (to.getTime() - from.getTime()) / DAY;
  return days <= 45 ? "day" : days <= 200 ? "week" : "month";
}

function resolutionHours(issue: IssueSummary): number | null {
  if (issue.status !== "Resolved" || !issue.resolvedAt) return null;
  const hours = (issue.resolvedAt.getTime() - issue.createdAt.getTime()) / HOUR;
  return hours >= 0 ? hours : null;
}

export interface ResolutionStats {
  count: number;
  averageHours: number | null;
  medianHours: number | null;
}

export function resolutionStats(issues: IssueSummary[]): ResolutionStats {
  const hours = issues.map(resolutionHours).filter((h): h is number => h !== null).sort((a, b) => a - b);
  if (hours.length === 0) return { count: 0, averageHours: null, medianHours: null };
  const mid = Math.floor(hours.length / 2);
  const median = hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
  const average = hours.reduce((a, b) => a + b, 0) / hours.length;
  return { count: hours.length, averageHours: round1(average), medianHours: round1(median) };
}

export function resolutionByCategory(issues: IssueSummary[]): { name: string; averageHours: number; count: number }[] {
  const groups = new Map<string, IssueSummary[]>();
  for (const issue of issues) groups.set(issue.category, [...(groups.get(issue.category) ?? []), issue]);
  const rows: { name: string; averageHours: number; count: number }[] = [];
  for (const [name, list] of groups) {
    const stats = resolutionStats(list);
    if (stats.averageHours !== null) rows.push({ name, averageHours: stats.averageHours, count: stats.count });
  }
  return rows.sort((a, b) => b.averageHours - a.averageHours);
}

export interface Hotspot {
  buildingId: string;
  name: string;
  total: number;
  open: number;
  resolved: number;
  topCategory: string | null;
  averageResolutionHours: number | null;
}

/** Issue counts per building. Issues whose location can't be placed are counted separately. */
export function hotspots(
  issues: IssueSummary[],
  locationBuildings: Map<string, string> = new Map()
): { buildings: Hotspot[]; unplaced: number } {
  const groups = new Map<string, IssueSummary[]>();
  let unplaced = 0;
  for (const issue of issues) {
    const building = buildingForIssue(issue, locationBuildings);
    if (!building) {
      unplaced++;
      continue;
    }
    groups.set(building.id, [...(groups.get(building.id) ?? []), issue]);
  }
  const buildings = BUILDINGS.map((b) => {
    const list = groups.get(b.id) ?? [];
    const top = categoryDistribution(list)[0];
    return {
      buildingId: b.id,
      name: b.name,
      total: list.length,
      open: list.filter((i) => i.status !== "Resolved").length,
      resolved: list.filter((i) => i.status === "Resolved").length,
      topCategory: top ? top.name : null,
      averageResolutionHours: resolutionStats(list).averageHours,
    };
  });
  return { buildings, unplaced };
}

export interface WorkerLoad {
  workerId: string;
  active: number;
  resolved: number;
  averageResolutionHours: number | null;
  resolvedByCategory: Record<string, number>;
}

export function workerWorkload(issues: IssueSummary[]): WorkerLoad[] {
  const groups = new Map<string, IssueSummary[]>();
  for (const issue of issues) {
    if (!issue.assignedTo) continue;
    groups.set(issue.assignedTo, [...(groups.get(issue.assignedTo) ?? []), issue]);
  }
  return [...groups.entries()].map(([workerId, list]) => {
    const resolved = list.filter((i) => i.status === "Resolved");
    const byCategory: Record<string, number> = {};
    for (const i of resolved) byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
    return {
      workerId,
      active: list.length - resolved.length,
      resolved: resolved.length,
      averageResolutionHours: resolutionStats(list).averageHours,
      resolvedByCategory: byCategory,
    };
  });
}

export interface SlaSummary {
  counts: Record<SlaState, number>;
  /** Unresolved issues that are approaching or past their deadline, most urgent first. */
  alerts: { issue: IssueSummary; state: "approaching" | "breached"; deadline: Date; remainingMs: number }[];
}

export function slaSummary(issues: IssueSummary[], config: SlaConfig, now: Date = new Date()): SlaSummary {
  const counts: Record<SlaState, number> = { "on-track": 0, approaching: 0, breached: 0, met: 0, missed: 0 };
  const alerts: SlaSummary["alerts"] = [];
  for (const issue of issues) {
    const sla = computeSla(issue, config, now);
    counts[sla.state]++;
    if (sla.state === "approaching" || sla.state === "breached") {
      alerts.push({ issue, state: sla.state, deadline: sla.deadline, remainingMs: sla.remainingMs });
    }
  }
  alerts.sort((a, b) => a.remainingMs - b.remainingMs);
  return { counts, alerts };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
