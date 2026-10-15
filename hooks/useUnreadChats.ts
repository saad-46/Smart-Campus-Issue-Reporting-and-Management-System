"use client";

import { useEffect, useState } from "react";
import { isConversationUnread } from "@/lib/models";
import { subscribeToMyConversations } from "@/services/chatService";
import { logError } from "@/lib/errors";

/**
 * Ids of the issues whose private chat has messages the signed-in user hasn't
 * seen yet. One bounded query on the conversation summaries, not on messages.
 */
export function useUnreadChats(uid: string | undefined | null): Set<string> {
  const [unread, setUnread] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!uid) {
      setUnread(new Set());
      return;
    }
    return subscribeToMyConversations(
      uid,
      (list) => setUnread(new Set(list.filter((c) => isConversationUnread(c, uid)).map((c) => c.issueId))),
      (err) => logError("subscribeToMyConversations", err)
    );
  }, [uid]);

  return unread;
}
