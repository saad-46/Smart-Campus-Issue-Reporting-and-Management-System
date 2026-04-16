// ============================================
// escalationService.ts — Handles logic to escalate unresolved issues
// ============================================
import { Issue } from "@/types";
import { updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Checks open/in-progress issues and escalates them if they are older than 24 hours.
 * (For hackathon demo purposes, we might trigger this manually or with a simulated time.)
 */
export async function simulateEscalation(issues: Issue[]): Promise<number> {
  const now = new Date();
  let escalatedCount = 0;

  for (const issue of issues) {
    if (issue.status === "Resolved" || issue.escalated) continue;

    const hoursSinceCreation = (now.getTime() - issue.createdAt.getTime()) / (1000 * 60 * 60);

    // If simulating, maybe set threshold to a few hours or minutes, but 24 is realistic.
    // For the sake of the hackathon, we'll assume any unresolved high priority that has some age is escalated.
    // Let's use a 24-hour threshold for realism, but we can have an override.
    if (hoursSinceCreation >= 24 || (issue.priority === "High" && hoursSinceCreation > 2)) {
      try {
        await updateDoc(doc(db, "issues", issue.id), {
          escalated: true,
        });
        escalatedCount++;
      } catch (e) {
        console.error("Failed to escalate issue:", issue.id, e);
      }
    }
  }

  return escalatedCount;
}

/**
 * Manual Admin override to escalate an issue instantly.
 */
export async function forceEscalateIssue(issueId: string): Promise<void> {
  await updateDoc(doc(db, "issues", issueId), {
    escalated: true,
  });
}
