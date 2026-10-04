// ============================================
// Viewer guide preference (this browser only)
// ============================================
// Remembers that the short Viewer guide was seen. localStorage only — no
// account or Firestore document is involved. Storage can be blocked
// (private windows, strict settings); then the guide simply shows again.

export const VIEWER_GUIDE_KEY = "smart-campus-viewer-guide-seen";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function hasSeenViewerGuide(store: StorageLike | null = storage()): boolean {
  try {
    return store?.getItem(VIEWER_GUIDE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markViewerGuideSeen(store: StorageLike | null = storage()): void {
  try {
    store?.setItem(VIEWER_GUIDE_KEY, "1");
  } catch {
    // Storage unavailable: nothing to remember.
  }
}
