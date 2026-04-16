// ============================================
// Real-time Chat Service
// ============================================
// Handles messaging inside issue sub-collections

import { collection, addDoc, onSnapshot, query, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChatMessage } from "@/types";

const ISSUES_COLLECTION = "issues";
const CHAT_SUBCOLLECTION = "messages";

/**
 * Subscribes to the chat messages sub-collection of a specific issue.
 * Ordered by createdAt ascending.
 */
export function subscribeToIssueChat(issueId: string, callback: (messages: ChatMessage[]) => void) {
  const q = query(
    collection(db, ISSUES_COLLECTION, issueId, CHAT_SUBCOLLECTION),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text,
        authorId: data.authorId,
        authorName: data.authorName,
        authorRole: data.authorRole,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(),
      } as ChatMessage;
    });
    callback(messages);
  });
}

/**
 * Sends a real-time message to a specific issue thread.
 */
export async function sendChatMessage(
  issueId: string,
  text: string,
  authorId: string,
  authorName: string,
  authorRole: string
): Promise<void> {
  const messagesRef = collection(db, ISSUES_COLLECTION, issueId, CHAT_SUBCOLLECTION);
  
  await addDoc(messagesRef, {
    text,
    authorId,
    authorName,
    authorRole,
    createdAt: Timestamp.now(),
  });
}
