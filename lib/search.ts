// ============================================
// Issue search
// ============================================
// Firestore has no full-text search, so the app searches a bounded,
// lightweight projection of the most recent issues (QUERY_LIMITS.search)
// in the browser, plus an exact lookup by issue ID. Descriptions are not
// part of the projection (they can be large), so they aren't searched.

import { IssueStatus, IssueSummary, Priority } from "@/types";
import { tokenize } from "./intelligence/similarity";

export interface SearchFilters {
  status?: IssueStatus;
  category?: string;
  priority?: Priority;
}

export interface SearchHit {
  issue: IssueSummary;
  score: number;
}

/**
 * Rank issues against a free-text query. An exact or prefix match on the
 * issue ID ranks first, then title, location and category matches.
 * Synonyms are folded ("wifi" finds "internet").
 */
export function searchIssues(issues: IssueSummary[], query: string, filters: SearchFilters = {}, max = 50): SearchHit[] {
  const q = query.trim().toLowerCase().replace(/^#/, "");
  const tokens = [...tokenize(q)];
  const candidates = issues.filter(
    (i) =>
      (!filters.status || i.status === filters.status) &&
      (!filters.category || i.category === filters.category) &&
      (!filters.priority || i.priority === filters.priority)
  );
  if (!q) {
    return candidates
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, max)
      .map((issue) => ({ issue, score: 0 }));
  }

  const hits: SearchHit[] = [];
  for (const issue of candidates) {
    let score = 0;
    const id = issue.id.toLowerCase();
    if (id === q) score += 100;
    else if (q.length >= 4 && id.startsWith(q)) score += 60;

    const title = issue.title.toLowerCase();
    const location = issue.location.toLowerCase();
    if (title.includes(q)) score += 20;
    if (location.includes(q)) score += 12;
    if (issue.category.toLowerCase() === q || issue.status.toLowerCase() === q) score += 10;

    if (tokens.length) {
      const words = tokenize(`${issue.title} ${issue.location} ${issue.category}`);
      const matched = tokens.filter((t) => words.has(t)).length;
      score += (matched / tokens.length) * 15;
    }
    if (score > 0) hits.push({ issue, score: Math.round(score * 10) / 10 });
  }
  return hits
    .sort((a, b) => b.score - a.score || b.issue.createdAt.getTime() - a.issue.createdAt.getTime())
    .slice(0, max);
}
