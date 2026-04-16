// ============================================
// predictionService.ts — Predictive Analytics Engine
// ============================================
import { Issue } from "@/types";

export interface PredictedIssue {
  location: string;
  issueType: string;
  riskLevel: string;
}

/**
 * Analyzes trends to identify predicted recurring issues based on historical data.
 */
export function analyzeTrends(issues: Issue[]): PredictedIssue[] {
  // Only look at open/in progress issues
  const activeIssues = issues.filter((i) => i.status !== "Resolved");

  const frequencyMap: Record<string, { category: string; location: string; count: number }> = {};

  for (const issue of activeIssues) {
    const key = `${issue.category.trim().toLowerCase()}|${issue.location.trim().toLowerCase()}`;
    if (!frequencyMap[key]) {
      frequencyMap[key] = {
        category: issue.category,
        location: issue.location,
        count: 0
      };
    }
    frequencyMap[key].count++;
  }

  const predictions: PredictedIssue[] = [];

  for (const key in frequencyMap) {
    if (frequencyMap[key].count >= 5) {
      predictions.push({
        location: frequencyMap[key].location,
        issueType: frequencyMap[key].category,
        riskLevel: "High"
      });
    }
  }

  return predictions;
}
