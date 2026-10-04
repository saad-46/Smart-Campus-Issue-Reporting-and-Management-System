// ============================================
// Real-time Chat Service
// ============================================
// Handles messaging inside issue sub-collections

import {
  collection,
  doc,
  runTransaction,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  FirestoreError,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatMessage, UserRole } from "@/types";
import { LIMITS } from "@/lib/constants";
import { assertOnline } from "@/lib/errors";
import { track } from "@/lib/listeners";
import { normalizeChatMessage } from "@/lib/models";
import { validateChatMessage } from "@/lib/validation";

const ISSUES_COLLECTION = "issues";
const CHAT_SUBCOLLECTION = "messages";

/**
 * Subscribes to the chat messages sub-collection of a specific issue.
 * Ordered by createdAt ascending.
 */
export function subscribeToIssueChat(
  issueId: string,
  callback: (messages: ChatMessage[]) => void,
  onError?: (error: FirestoreError) => void
) {
  const q = query(
    collection(db, ISSUES_COLLECTION, issueId, CHAT_SUBCOLLECTION),
    orderBy("createdAt", "asc")
  );

  return track(
    onSnapshot(
      q,
      (snapshot) => {
        callback(
          snapshot.docs.map((d) => normalizeChatMessage(d.id, d.data({ serverTimestamps: "estimate" })))
        );
      },
      (error) => onError?.(error)
    )
  );
}

/**
 * Sends a real-time message to a specific issue thread.
 */
export async function sendChatMessage(
  issueId: string,
  text: string,
  authorId: string,
  authorName: string,
  authorRole: UserRole
): Promise<void> {
  assertOnline();
  const messagesRef = collection(db, ISSUES_COLLECTION, issueId, CHAT_SUBCOLLECTION);

  const message = {
    text: validateChatMessage(text),
    authorId,
    authorName: authorName.trim().slice(0, LIMITS.name) || "Unknown",
    authorRole,
    createdAt: serverTimestamp(),
  };

  // Sent in a transaction so it is never queued while offline: it either
  // reaches the server or fails, and the UI only clears the box on success.
  const messageRef = doc(messagesRef);
  await runTransaction(db, async (transaction) => {
    transaction.set(messageRef, message);
  });
}
