"use client";

import { useEffect, useState } from "react";
import { AppNotification } from "@/types";
import { subscribeToNotifications } from "@/lib/notifications";
import { logError } from "@/lib/errors";

interface State {
  items: AppNotification[];
  loading: boolean;
  error: boolean;
}

// One shared listener per signed-in user, reference-counted, so the bell in
// the top bar and the sidebar never open duplicate subscriptions.
let ownerId: string | null = null;
let state: State = { items: [], loading: true, error: false };
let unsubscribe: (() => void) | null = null;
const subscribers = new Set<(s: State) => void>();

function publish(next: State) {
  state = next;
  subscribers.forEach((notify) => notify(next));
}

function stop() {
  unsubscribe?.();
  unsubscribe = null;
  ownerId = null;
}

export function useNotifications(userId: string | undefined): State & { unread: number } {
  const [snapshot, setSnapshot] = useState<State>(userId && ownerId === userId ? state : { items: [], loading: !!userId, error: false });

  useEffect(() => {
    if (!userId) return;
    subscribers.add(setSnapshot);
    if (ownerId !== userId) {
      stop();
      ownerId = userId;
      publish({ items: [], loading: true, error: false });
      unsubscribe = subscribeToNotifications(
        userId,
        (items) => publish({ items, loading: false, error: false }),
        (err) => {
          logError("subscribeToNotifications", err);
          publish({ items: state.items, loading: false, error: true });
        }
      );
    }
    setSnapshot(state);
    return () => {
      subscribers.delete(setSnapshot);
      if (subscribers.size === 0) stop();
    };
  }, [userId]);

  return { ...snapshot, unread: snapshot.items.filter((n) => !n.readAt).length };
}
