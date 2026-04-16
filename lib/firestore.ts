// ============================================
// Firestore CRUD Operations for Issues
// ============================================
// All database operations for the issues collection.
// Includes real-time listeners for live updates.

import {
  collection,
  doc,
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
  priority: Priority
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
  await updateDoc(doc(db, ISSUES_COLLECTION, issueId), {
    status,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Assign an issue to an admin.
 */
export async function assignIssue(
  issueId: string,
  adminId: string
): Promise<void> {
  await updateDoc(doc(db, ISSUES_COLLECTION, issueId), {
    assignedTo: adminId,
    status: "In Progress" as IssueStatus,
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
