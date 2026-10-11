// ============================================
// Real-time issue chat
// ============================================
// Messages live in issues/{id}/messages. A small summary document,
// conversations/{id}, carries the participants, the last message and each
// participant's read marker, so unread counts need one bounded query.
//
// Who may read and post is decided by firestore.rules (the reporter, the
// worker the issue is assigned to right now, and administrators); nothing
// here is a security boundary.

import {
  collection,
  doc,
  limit as limitTo,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatMessage, Conversation, UserRole } from "@/types";
import { LIMITS } from "@/lib/constants";
import { assertOnline } from "@/lib/errors";
import { track } from "@/lib/listeners";
import { normalizeChatMessage, normalizeConversation } from "@/lib/models";
import { validateChatMessage } from "@/lib/validation";
import { assertRealId } from "@/lib/sharedRules";

const ISSUES_COLLECTION = "issues";
const CHAT_SUBCOLLECTION = "messages";
const CONVERSATIONS = "conversations";

/** Messages loaded at once; "load earlier" raises it in steps. */
export const CHAT_PAGE_SIZE = 50;
export const CHAT_MAX_LOADED = 500;
const PREVIEW_CHARS = 120;

/**
 * Subscribes to the newest `pageSize` messages of an issue, returned oldest
 * first. Bounded: the listener never downloads the whole history.
 */
export function subscribeToIssueChat(
  issueId: string,
  callback: (messages: ChatMessage[], hasMore: boolean) => void,
  onError?: (error: FirestoreError) => void,
  pageSize: number = CHAT_PAGE_SIZE
) {
  const size = Math.min(Math.max(1, pageSize), CHAT_MAX_LOADED);
  const q = query(collection(db, ISSUES_COLLECTION, issueId, CHAT_SUBCOLLECTION), orderBy("createdAt", "desc"), limitTo(size + 1));

  return track(
    onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.slice(0, size);
        const messages = docs.map((d) => normalizeChatMessage(d.id, d.data({ serverTimestamps: "estimate" }))).reverse();
        callback(messages, snapshot.docs.length > size);
      },
      (error) => onError?.(error)
    )
  );
}

/** The people an issue's chat is between, as the issue document says right now. */
export interface ChatContext {
  /** The reporter. */
  studentId: string;
  /** The assignee, or "" while nobody has taken the issue. */
  workerId: string;
}

/**
 * Sends a message. In one transaction it also keeps the conversation summary
 * current (creating it with the first message once a worker is assigned), so
 * the summary can never lag the message it describes.
 */
export async function sendChatMessage(
  issueId: string,
  text: string,
  authorId: string,
  authorName: string,
  authorRole: UserRole,
  context?: ChatContext
): Promise<void> {
  assertRealId(issueId, "issue");
  assertOnline();
  const clean = validateChatMessage(text);
  const messageRef = doc(collection(db, ISSUES_COLLECTION, issueId, CHAT_SUBCOLLECTION));
  const summaryRef = doc(db, CONVERSATIONS, issueId);
  const isParticipant = !!context && !!context.workerId && (authorId === context.studentId || authorId === context.workerId);

  // A transaction, not a queued write: it either reaches the server or
  // fails, and the UI only clears the box on success.
  await runTransaction(db, async (transaction) => {
    const existing = isParticipant ? await transaction.get(summaryRef) : null;

    transaction.set(messageRef, {
      text: clean,
      authorId,
      authorName: authorName.trim().slice(0, LIMITS.name) || "Unknown",
      authorRole,
      createdAt: serverTimestamp(),
    });

    if (!isParticipant || !context) return;
    const preview = clean.replace(/\s+/g, " ").slice(0, PREVIEW_CHARS);
    if (existing?.exists()) {
      transaction.update(summaryRef, {
        workerId: context.workerId,
        participants: [context.studentId, context.workerId],
        lastMessageAt: serverTimestamp(),
        lastSenderId: authorId,
        lastPreview: preview,
        readAt: { ...((existing.data().readAt as Record<string, unknown>) ?? {}), [authorId]: serverTimestamp() },
      });
    } else {
      transaction.set(summaryRef, {
        issueId,
        studentId: context.studentId,
        workerId: context.workerId,
        participants: [context.studentId, context.workerId],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastSenderId: authorId,
        lastPreview: preview,
        readAt: { [authorId]: serverTimestamp() },
      });
    }
  });
}

/** Marks the conversation read for `uid`. Quietly does nothing if there is no summary yet. */
export async function markConversationRead(issueId: string, uid: string): Promise<void> {
  assertRealId(issueId, "issue");
  try {
    await updateDoc(doc(db, CONVERSATIONS, issueId), { [`readAt.${uid}`]: serverTimestamp() });
  } catch (err) {
    const code = (err as { code?: string }).code;
    // No summary yet (nobody has written since assignment), or not a participant: nothing to mark.
    if (code !== "not-found" && code !== "permission-denied") throw err;
  }
}

/** The signed-in user's conversations (bounded), for unread badges. */
export function subscribeToMyConversations(
  uid: string,
  callback: (conversations: Conversation[]) => void,
  onError?: (error: FirestoreError) => void
) {
  const q = query(collection(db, CONVERSATIONS), where("participants", "array-contains", uid), limitTo(100));
  return track(
    onSnapshot(
      q,
      (snapshot) => callback(snapshot.docs.map((d) => normalizeConversation(d.id, d.data({ serverTimestamps: "estimate" })))),
      (error) => onError?.(error)
    )
  );
}
