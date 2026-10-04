// ============================================
// Real-time listener bookkeeping
// ============================================
// Every onSnapshot subscription in the app goes through track(), so the
// number of open listeners can be checked for leaks during development
// (window.__unifixListeners). Nothing is exposed in production builds.

let open = 0;

function publish(): void {
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as { __unifixListeners?: number }).__unifixListeners = open;
  }
}

/** Wrap an unsubscribe function so open listeners are counted; safe to call twice. */
export function track(unsubscribe: () => void): () => void {
  open++;
  publish();
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    open--;
    publish();
    unsubscribe();
  };
}

export function openListenerCount(): number {
  return open;
}
