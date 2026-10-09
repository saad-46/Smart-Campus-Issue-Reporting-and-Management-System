// ============================================
// Maintenance Risk Indicator
// ============================================
// A transparent, rule-based score — not a machine-learning prediction.
// For each place it combines how often issues occur, whether the same
// kind of problem keeps recurring, how recent the last one was, and how
// severe they were. Every input is shown next to the result.

import { IssueSummary } from "@/types";
import { buildingForIssue } from "@/lib/campus";

const DAY = 86_400_000;

/** The score looks at this much history. */
export const RISK_WINDOW_DAYS = 90;
/** Below these, the app says there isn't enough data instead of guessing. */
export const RISK_MIN_ISSUES = 10;
export const RISK_MIN_HISTORY_DAYS = 14;
/** A place needs at least this many issues in the window to be scored. */
export const RISK_MIN_ISSUES_PER_PLACE = 3;

export type RiskLevel = "Low" | "Medium" | "High";

export interface RiskIndicator {
  key: string;
  label: string;
  buildingId: string | null;
  level: RiskLevel;
  score: number;
  issuesInWindow: number;
  issuesLast30Days: number;
  repeatedCategory: string | null;
  repeatedCount: number;
  daysSinceLastIssue: number;
  highPriorityShare: number;
}

export type RiskResult =
  | { sufficient: true; indicators: RiskIndicator[] }
  | { sufficient: false; reason: string };

/** Room-like number in a location. The number of a block ("Block 4") is not a room. */
function roomOf(location: string): string | null {
  return location.toLowerCase().replace(/\bblocks?\s*\d+\b/g, " ").match(/\b(?:room|lab|hall|restroom|washroom)?\s*(\d{1,4}[a-z]?)\b/)?.[1] ?? null;
}

/** Group key + label for a place: a QR location, else building + room, else the text itself. */
function placeOf(issue: IssueSummary, locationBuildings: Map<string, string>, locationNames: Map<string, string>) {
  if (issue.locationId) {
    return {
      key: `loc:${issue.locationId}`,
      label: locationNames.get(issue.locationId) ?? issue.location,
      buildingId: locationBuildings.get(issue.locationId) ?? null,
    };
  }
  const building = buildingForIssue(issue, locationBuildings);
  const room = roomOf(issue.location);
  if (building) {
    return {
      key: `b:${building.id}:${room ?? "*"}`,
      label: room ? `${building.name} — ${room.toUpperCase()}` : building.name,
      buildingId: building.id,
    };
  }
  const text = issue.location.trim().toLowerCase();
  return { key: `t:${text}`, label: issue.location.trim() || "Unknown location", buildingId: null };
}

export function riskLevel(score: number): RiskLevel {
  return score >= 0.6 ? "High" : score >= 0.35 ? "Medium" : "Low";
}

export function maintenanceRisk(
  issues: IssueSummary[],
  now: Date = new Date(),
  locationBuildings: Map<string, string> = new Map(),
  locationNames: Map<string, string> = new Map()
): RiskResult {
  const since = now.getTime() - RISK_WINDOW_DAYS * DAY;
  const recent = issues.filter((i) => i.createdAt.getTime() >= since && i.createdAt.getTime() <= now.getTime());
  if (recent.length < RISK_MIN_ISSUES) {
    return {
      sufficient: false,
      reason: `Not enough history yet: ${recent.length} issue${recent.length === 1 ? "" : "s"} in the last ${RISK_WINDOW_DAYS} days (at least ${RISK_MIN_ISSUES} needed).`,
    };
  }
  const oldest = Math.min(...recent.map((i) => i.createdAt.getTime()));
  if (now.getTime() - oldest < RISK_MIN_HISTORY_DAYS * DAY) {
    return {
      sufficient: false,
      reason: `Not enough history yet: records only go back ${Math.floor((now.getTime() - oldest) / DAY)} days (at least ${RISK_MIN_HISTORY_DAYS} needed).`,
    };
  }

  const groups = new Map<string, { label: string; buildingId: string | null; issues: IssueSummary[] }>();
  for (const issue of recent) {
    const place = placeOf(issue, locationBuildings, locationNames);
    const group = groups.get(place.key) ?? { label: place.label, buildingId: place.buildingId, issues: [] };
    group.issues.push(issue);
    groups.set(place.key, group);
  }

  const indicators: RiskIndicator[] = [];
  for (const [key, group] of groups) {
    const list = group.issues;
    if (list.length < RISK_MIN_ISSUES_PER_PLACE) continue;

    const last30 = list.filter((i) => i.createdAt.getTime() >= now.getTime() - 30 * DAY).length;
    const byCategory = new Map<string, number>();
    for (const i of list) byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + 1);
    const [topCategory, topCount] = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const lastIssue = Math.max(...list.map((i) => i.createdAt.getTime()));
    const daysSinceLast = Math.floor((now.getTime() - lastIssue) / DAY);
    const highShare = list.filter((i) => i.priority === "High").length / list.length;

    const frequency = Math.min(1, last30 / 6);
    const recurrence = topCount >= 3 ? topCount / list.length : 0;
    const recency = Math.max(0, 1 - daysSinceLast / 30);
    const score = Math.round((0.4 * frequency + 0.25 * recurrence + 0.2 * recency + 0.15 * highShare) * 100) / 100;

    indicators.push({
      key,
      label: group.label,
      buildingId: group.buildingId,
      level: riskLevel(score),
      score,
      issuesInWindow: list.length,
      issuesLast30Days: last30,
      repeatedCategory: topCount >= 3 ? topCategory : null,
      repeatedCount: topCount,
      daysSinceLastIssue: daysSinceLast,
      highPriorityShare: Math.round(highShare * 100) / 100,
    });
  }
  indicators.sort((a, b) => b.score - a.score);
  return { sufficient: true, indicators };
}
