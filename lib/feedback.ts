// ============================================
// Resolution feedback
// ============================================
// feedback/{issueId}: one rating per resolved issue, by its reporter
// (enforced by firestore.rules). Readable only by its author and admins.

import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { db } from "./firebase";
import { Feedback, Issue } from "@/types";
import { QUERY_LIMITS } from "./constants";
import { ValidationError, assertOnline } from "./errors";
import { normalizeFeedback } from "./models";
import { queueEvent } from "./timeline";
import { FEEDBACK_COMMENT_MAX, validateFeedbackInput } from "./sharedRules";

const FEEDBACK = "feedback";
// The input rules live in lib/sharedRules.ts so Explore Mode validates with the same code.
export { FEEDBACK_COMMENT_MAX, validateFeedbackInput };

export async function submitFeedback(issue: Issue, userId: string, rating: number, comment: string): Promise<void> {
  const input = validateFeedbackInput(rating, comment);
  if (issue.createdBy !== userId) throw new ValidationError("Only the person who reported this issue can rate it.");
  if (issue.status !== "Resolved") throw new ValidationError("You can rate an issue once it has been resolved.");
  assertOnline();

  const ref = doc(db, FEEDBACK, issue.id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) throw new ValidationError("You've already rated this issue.");
    transaction.set(ref, {
      issueId: issue.id,
      rating: input.rating,
      comment: input.comment,
      createdBy: userId,
      assignedTo: issue.assignedTo,
      category: issue.category,
      createdAt: serverTimestamp(),
    });
    queueEvent(transaction, issue.id, "user", { type: "feedback", rating: input.rating });
  });
}

/** The feedback on one issue (author or admin only), or null. */
export async function getFeedback(issueId: string): Promise<Feedback | null> {
  const snap = await getDoc(doc(db, FEEDBACK, issueId));
  return snap.exists() ? normalizeFeedback(snap.id, snap.data()) : null;
}

/** Ids of the issues this user has already rated. */
export async function getMyRatedIssueIds(userId: string): Promise<Set<string>> {
  const snap = await getDocs(query(collection(db, FEEDBACK), where("createdBy", "==", userId), limit(QUERY_LIMITS.feedback)));
  return new Set(snap.docs.map((d) => d.id));
}

/** Most recent feedback for admin analytics. */
export async function getRecentFeedback(max: number = QUERY_LIMITS.feedback): Promise<Feedback[]> {
  const snap = await getDocs(query(collection(db, FEEDBACK), orderBy("createdAt", "desc"), limit(max)));
  return snap.docs.map((d) => normalizeFeedback(d.id, d.data())).filter((f): f is Feedback => f !== null);
}

export interface SatisfactionSummary {
  count: number;
  average: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Ratings of 1–2, newest first. Shown without the reporter's identity. */
  lowRated: Feedback[];
}

export function summarizeSatisfaction(feedback: Feedback[]): SatisfactionSummary {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const f of feedback) distribution[f.rating as 1 | 2 | 3 | 4 | 5]++;
  const total = feedback.reduce((s, f) => s + f.rating, 0);
  return {
    count: feedback.length,
    average: feedback.length ? Math.round((total / feedback.length) * 10) / 10 : null,
    distribution,
    lowRated: feedback.filter((f) => f.rating <= 2).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}
