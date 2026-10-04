// ============================================
// Factual insights
// ============================================
// Each insight is computed from the loaded issues; when there isn't
// enough data for one, it says so instead of producing a number.

import { IssueSummary, SlaConfig } from "@/types";
import { buildingForIssue } from "@/lib/campus";
import { resolutionByCategory, slaSummary } from "./analytics";
import { confirmedClusters } from "./similarity";

export interface Insight {
  id: string;
  text: string;
  /** False when the insight is a "not enough data" notice. */
  hasData: boolean;
}

const DAY = 86_400_000;

/**
 * @param issues issues covering at least the current and the previous period
 * @param periodDays length of the period being compared (e.g. 30)
 */
export function generateInsights(
  issues: IssueSummary[],
  periodDays: number,
  config: SlaConfig,
  now: Date = new Date(),
  locationBuildings: Map<string, string> = new Map()
): Insight[] {
  const insights: Insight[] = [];
  const currentStart = now.getTime() - periodDays * DAY;
  const previousStart = currentStart - periodDays * DAY;
  const current = issues.filter((i) => i.createdAt.getTime() >= currentStart);
  const previous = issues.filter((i) => i.createdAt.getTime() >= previousStart && i.createdAt.getTime() < currentStart);

  // 1. Category trend versus the previous period.
  if (previous.length < 5 || current.length < 5) {
    insights.push({
      id: "trend",
      hasData: false,
      text: `Not enough historical data to compare with the previous ${periodDays} days.`,
    });
  } else {
    const count = (list: IssueSummary[], c: string) => list.filter((i) => i.category === c).length;
    const categories = [...new Set([...current, ...previous].map((i) => i.category))];
    const changes = categories
      .map((c) => ({ c, now: count(current, c), before: count(previous, c) }))
      .filter((x) => x.before >= 3 && x.now + x.before >= 6)
      .map((x) => ({ ...x, pct: Math.round(((x.now - x.before) / x.before) * 100) }))
      .filter((x) => x.pct !== 0)
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    const top = changes[0];
    insights.push(
      top
        ? {
            id: "trend",
            hasData: true,
            text: `${top.c} issues ${top.pct > 0 ? "increased" : "decreased"} by ${Math.abs(top.pct)}% compared with the previous ${periodDays}-day period (${top.before} → ${top.now}).`,
          }
        : { id: "trend", hasData: true, text: `No category changed noticeably compared with the previous ${periodDays} days.` }
    );
  }

  // 2. Building with the most unresolved issues.
  const unresolved = issues.filter((i) => i.status !== "Resolved");
  const byBuilding = new Map<string, number>();
  for (const issue of unresolved) {
    const b = buildingForIssue(issue, locationBuildings);
    if (b) byBuilding.set(b.name, (byBuilding.get(b.name) ?? 0) + 1);
  }
  const worst = [...byBuilding.entries()].sort((a, b) => b[1] - a[1])[0];
  insights.push(
    worst && worst[1] >= 3
      ? { id: "building", hasData: true, text: `${worst[0]} has the most unresolved issues (${worst[1]}).` }
      : { id: "building", hasData: false, text: "Not enough unresolved issues with a known building to compare locations." }
  );

  // 3. Slowest category to resolve.
  const byCategory = resolutionByCategory(current.length ? current : issues).filter((c) => c.count >= 3);
  insights.push(
    byCategory.length >= 2
      ? {
          id: "slowest",
          hasData: true,
          text: `${byCategory[0].name} issues take the longest to resolve (average ${byCategory[0].averageHours} h over ${byCategory[0].count} issues).`,
        }
      : { id: "slowest", hasData: false, text: "Not enough resolved issues to compare resolution times across categories." }
  );

  // 4. SLA pressure right now.
  const sla = slaSummary(unresolved, config, now);
  insights.push({
    id: "sla",
    hasData: true,
    text:
      sla.counts.breached + sla.counts.approaching === 0
        ? "No open issue reported in this period is near or past its SLA deadline."
        : `Of the open issues reported in this period, ${sla.counts.approaching} ${sla.counts.approaching === 1 ? "is" : "are"} approaching the SLA deadline and ${sla.counts.breached} ${sla.counts.breached === 1 ? "has" : "have"} breached it.`,
  });

  // 5. Largest confirmed incident.
  const cluster = confirmedClusters(issues).find((c) => c.status !== "Resolved");
  if (cluster) {
    insights.push({
      id: "cluster",
      hasData: true,
      text: `Largest active incident: "${cluster.title}" with ${cluster.reportCount} linked reports.`,
    });
  }
  return insights;
}
