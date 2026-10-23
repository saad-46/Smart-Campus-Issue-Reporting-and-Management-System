// ============================================
// Campus timeline for the signed-in app
// ============================================
// Built only from timestamps that really exist on an issue (reported,
// started, resolved), so nothing on the page is estimated or invented.
// Explore derives the same kinds of entries from its sample issues.

import { Issue, IssueEventType, UserRole } from "@/types";

export interface ActivityEntry {
  id: string;
  type: Extract<IssueEventType, "reported" | "linked" | "started" | "resolved">;
  at: Date;
  text: string;
  issue: Issue;
}

export const ACTIVITY_GROUPS: { value: string; label: string; types: ActivityEntry["type"][] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "reports", label: "Reports", types: ["reported", "linked"] },
  { value: "work", label: "Work", types: ["started", "resolved"] },
];

const valid = (d: Date | undefined): d is Date => d instanceof Date && !Number.isNaN(d.getTime());

/**
 * Newest first. A student sees every report being filed, but the progress of
 * their own issues only (as in Explore); staff see all of it.
 */
export function issueActivity(issues: Issue[], viewer: { id: string; role: UserRole }, limit = 400): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const issue of issues) {
    const own = issue.createdBy === viewer.id;
    const mayFollow = viewer.role !== "user" || own;
    const reporter = own ? "you" : viewer.role === "user" ? "another student" : issue.createdByName || "a student";
    if (valid(issue.createdAt)) {
      entries.push({
        id: `${issue.id}-reported`,
        type: "reported",
        at: issue.createdAt,
        // A student sees who they are, never another student's name; staff see names.
        text: `Reported by ${reporter} · ${issue.category}, ${issue.priority.toLowerCase()} priority`,
        issue,
      });
      if (mayFollow && issue.duplicateOf) {
        entries.push({ id: `${issue.id}-linked`, type: "linked", at: new Date(issue.createdAt.getTime() + 1), text: "Linked to another report as the same problem", issue });
      }
    }
    if (mayFollow && valid(issue.startedAt)) entries.push({ id: `${issue.id}-started`, type: "started", at: issue.startedAt, text: "Work started", issue });
    if (mayFollow && valid(issue.resolvedAt)) entries.push({ id: `${issue.id}-resolved`, type: "resolved", at: issue.resolvedAt, text: "Resolved", issue });
  }
  return entries.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
