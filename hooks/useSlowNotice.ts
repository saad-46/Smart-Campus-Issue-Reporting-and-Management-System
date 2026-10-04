"use client";

import { useEffect, useState } from "react";

/**
 * Becomes true when `active` has stayed true for longer than `delayMs`.
 *
 * Firestore queues a write while the server is unreachable instead of
 * failing it, so a save can sit pending indefinitely. This lets a form
 * explain what is happening rather than showing a spinner with no context —
 * without reporting a success that hasn't happened.
 */
export function useSlowNotice(active: boolean, delayMs = 10000): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return slow;
}
