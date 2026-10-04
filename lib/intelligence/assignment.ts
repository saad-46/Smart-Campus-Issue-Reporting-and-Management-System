// ============================================
// Worker assignment recommendations
// ============================================
// Ranks approved workers for an issue from recorded history only:
// experience with the category, current workload and student ratings.
// The admin always makes the final choice; a recommendation never
// assigns anyone or grants any permission by itself.

import { Feedback, User } from "@/types";
import { WorkerLoad } from "./analytics";

export interface WorkerRecommendation {
  workerId: string;
  name: string;
  score: number;
  reason: string;
  active: number;
  categoryResolved: number;
  averageRating: number | null;
}

export function averageRatings(feedback: Feedback[]): Map<string, { average: number; count: number }> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const f of feedback) {
    if (!f.assignedTo) continue;
    const s = sums.get(f.assignedTo) ?? { total: 0, count: 0 };
    sums.set(f.assignedTo, { total: s.total + f.rating, count: s.count + 1 });
  }
  return new Map(
    [...sums.entries()].map(([id, s]) => [id, { average: Math.round((s.total / s.count) * 10) / 10, count: s.count }])
  );
}

/**
 * Score = category experience (up to 0.5) + spare capacity (up to 0.35)
 * + rating (up to 0.15, only with at least 2 ratings).
 */
export function recommendWorkers(
  issue: { category: string; assignedTo?: string },
  workers: Pick<User, "id" | "name">[],
  loads: WorkerLoad[],
  ratings: Map<string, { average: number; count: number }> = new Map()
): WorkerRecommendation[] {
  const byId = new Map(loads.map((l) => [l.workerId, l]));
  const maxActive = Math.max(1, ...loads.map((l) => l.active));

  return workers
    .map((w) => {
      const load = byId.get(w.id);
      const active = load?.active ?? 0;
      const categoryResolved = load?.resolvedByCategory[issue.category] ?? 0;
      const rating = ratings.get(w.id);
      const usableRating = rating && rating.count >= 2 ? rating.average : null;

      const experience = Math.min(1, categoryResolved / 5) * 0.5;
      const capacity = (1 - active / (maxActive + 1)) * 0.35;
      const quality = usableRating !== null ? ((usableRating - 1) / 4) * 0.15 : 0;
      const score = Math.round((experience + capacity + quality) * 100) / 100;

      const parts: string[] = [];
      if (categoryResolved > 0) parts.push(`resolved ${categoryResolved} ${issue.category} issue${categoryResolved === 1 ? "" : "s"}`);
      parts.push(active === 0 ? "no active tasks" : `${active} active task${active === 1 ? "" : "s"}`);
      if (usableRating !== null) parts.push(`average rating ${usableRating}/5`);
      const reason = categoryResolved === 0 && usableRating === null
        ? `No ${issue.category} history yet — ${parts.join(", ")}`
        : parts.map((p, i) => (i === 0 ? p[0].toUpperCase() + p.slice(1) : p)).join(" · ");

      return { workerId: w.id, name: w.name, score, reason, active, categoryResolved, averageRating: usableRating };
    })
    .sort((a, b) => b.score - a.score || a.active - b.active || a.name.localeCompare(b.name));
}
