// ============================================
// Firestore CRUD Operations for Issues
// ============================================
// All database operations for the issues collection.
// Includes real-time listeners for live updates.

import {
  collection,
  doc,
  runTransaction,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { Issue, CreateIssueData, Priority, IssueStatus } from "@/types";

const ISSUES_COLLECTION = "issues";

/**
 * Convert a Firestore document to an Issue object.
 */
function docToIssue(docId: string, data: Record<string, unknown>): Issue {
  return {
    id: docId,
    title: data.title as string,
    description: data.description as string,
    category: data.category as string,
    priority: data.priority as Priority,
    status: data.status as IssueStatus,
    location: data.location as string,
    createdBy: data.createdBy as string,
    createdByName: data.createdByName as string,
    assignedTo: (data.assignedTo as string) || "",
    createdAt: data.createdAt instanceof Timestamp
      ? data.createdAt.toDate()
      : new Date(data.createdAt as string),
    updatedAt: data.updatedAt instanceof Timestamp
      ? data.updatedAt.toDate()
      : new Date(data.updatedAt as string),
    upvotes: (data.upvotes as number) || 0,
    upvotedBy: (data.upvotedBy as string[]) || [],
    escalated: (data.escalated as boolean) || false,
    startedAt: data.startedAt instanceof Timestamp ? data.startedAt.toDate() : undefined,
    resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate() : undefined,
    imageUrl: (data.imageUrl as string) || "",
  };
}

/**
 * Create a new issue in Firestore.
 */
export async function createIssue(
  issueData: CreateIssueData,
  userId: string,
  userName: string,
  category: string,
  priority: Priority,
  imageUrl?: string
): Promise<string> {
  const now = Timestamp.now();

  const docRef = await addDoc(collection(db, ISSUES_COLLECTION), {
    title: issueData.title,
    description: issueData.description,
    location: issueData.location,
    category,
    priority,
    status: "Open" as IssueStatus,
    createdBy: userId,
    createdByName: userName,
    assignedTo: "",
    createdAt: now,
    updatedAt: now,
    upvotes: 0,
    upvotedBy: [],
    escalated: false,
    imageUrl: imageUrl || "",
  });

  return docRef.id;
}

/**
 * Subscribe to ALL issues in real-time (for admin dashboard).
 * Returns an unsubscribe function.
 */
export function subscribeToAllIssues(
  callback: (issues: Issue[]) => void
): () => void {
  const q = query(
    collection(db, ISSUES_COLLECTION),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const issues = snapshot.docs.map((doc) =>
      docToIssue(doc.id, doc.data() as Record<string, unknown>)
    );
    callback(issues);
  });
}

/**
 * Subscribe to a SINGLE issue in real-time (for issue detail page).
 * Returns an unsubscribe function.
 */
export function subscribeToSingleIssue(
  issueId: string,
  callback: (issue: Issue | null) => void
): () => void {
  const docRef = doc(db, ISSUES_COLLECTION, issueId);
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(docToIssue(snapshot.id, snapshot.data() as Record<string, unknown>));
    } else {
      callback(null);
    }
  });
}

/**
 * Subscribe to issues created by a specific user (for user dashboard).
 * Returns an unsubscribe function.
 */
export function subscribeToUserIssues(
  userId: string,
  callback: (issues: Issue[]) => void
): () => void {
  const q = query(
    collection(db, ISSUES_COLLECTION),
    where("createdBy", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const issues = snapshot.docs.map((doc) =>
      docToIssue(doc.id, doc.data() as Record<string, unknown>)
    );
    callback(issues);
  });
}

/**
 * Update an issue's status.
 */
export async function updateIssueStatus(
  issueId: string,
  status: IssueStatus
): Promise<void> {
  const updates: Record<string, any> = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === "In Progress") {
    updates.startedAt = Timestamp.now();
  } else if (status === "Resolved") {
    updates.resolvedAt = Timestamp.now();
  }

  await updateDoc(doc(db, ISSUES_COLLECTION, issueId), updates);
}

/**
 * Assign an issue to an admin.
 */
export async function assignIssue(
  issueId: string,
  assigneeId: string
): Promise<void> {
  await updateDoc(doc(db, ISSUES_COLLECTION, issueId), {
    assignedTo: assigneeId,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete an issue.
 */
export async function deleteIssue(issueId: string): Promise<void> {
  await deleteDoc(doc(db, ISSUES_COLLECTION, issueId));
}

/**
 * Fetch all issues once (non-realtime).
 */
export async function getAllIssues(): Promise<Issue[]> {
  const q = query(
    collection(db, ISSUES_COLLECTION),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) =>
    docToIssue(doc.id, doc.data() as Record<string, unknown>)
  );
}

/**
 * Upvote or remove upvote for an issue by a user.
 * Uses a transaction to ensure atomicity.
 */
export async function toggleUpvote(issueId: string, userId: string): Promise<void> {
  const issueRef = doc(db, ISSUES_COLLECTION, issueId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(issueRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const upvotedBy: string[] = data.upvotedBy || [];
    let upvotes = data.upvotes || 0;
    if (upvotedBy.includes(userId)) {
      // remove upvote
      upvotedBy.splice(upvotedBy.indexOf(userId), 1);
      upvotes = Math.max(0, upvotes - 1);
    } else {
      upvotedBy.push(userId);
      upvotes = upvotes + 1;
    }
    const updates: any = { upvotes, upvotedBy };
    // Auto‑promote priority if threshold reached (default 5)
    if (upvotes >= 5 && data.priority !== "High") {
      updates.priority = "High" as Priority;
    }
    transaction.update(issueRef, updates);
  });
}
