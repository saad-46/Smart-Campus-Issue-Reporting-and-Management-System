import { Issue } from "@/types";

export function getResolvedIssuesCount(issues: Issue[]): number {
  return issues.filter((i) => i.status === "Resolved").length;
}

export function getPendingIssuesCount(issues: Issue[]): number {
  return issues.filter((i) => i.status !== "Resolved").length;
}

export function getIssuesByCategory(issues: Issue[]): { name: string; value: number }[] {
  const map: Record<string, number> = {};
  for (const issue of issues) {
    map[issue.category] = (map[issue.category] || 0) + 1;
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }));
}

export function getAverageResolutionTime(issues: Issue[]): {
  averageHours: number;
  fastCount: number;
  slowCount: number;
} {
  const resolved = issues.filter((i) => i.status === "Resolved");
  if (resolved.length === 0) return { averageHours: 0, fastCount: 0, slowCount: 0 };

  let totalHours = 0;
  let fastCount = 0;
  let slowCount = 0;

  for (const issue of resolved) {
    // Use updatedAt as proxy for resolvedAt since we don't store resolvedAt separately
    const hours = (issue.updatedAt.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60);
    totalHours += hours;
    if (hours < 24) fastCount++;
    else slowCount++;
  }

  return {
    averageHours: Math.round(totalHours / resolved.length),
    fastCount,
    slowCount,
  };
}
