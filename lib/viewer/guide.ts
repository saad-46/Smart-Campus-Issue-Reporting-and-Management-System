// ============================================
// Viewer preferences (this browser only)
// ============================================
// Remembers that the guided tour was seen (localStorage) and which
// perspective was last selected (sessionStorage, this tab only). No account
// or Firestore document is involved. Storage can be blocked (private
// windows, strict settings); then the tour simply shows again and the
// perspective falls back to the route's default.

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

// ---- Perspective (Student / Worker / Admin) ----

export const VIEWER_ROLE_KEY = "smart-campus-viewer-role";
const ROLES = ["student", "worker", "admin"] as const;
export type ViewerRole = (typeof ROLES)[number];

function sessionStore(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readViewerRole(store: StorageLike | null = sessionStore()): ViewerRole | null {
  try {
    const value = store?.getItem(VIEWER_ROLE_KEY);
    return (ROLES as readonly string[]).includes(value ?? "") ? (value as ViewerRole) : null;
  } catch {
    return null;
  }
}

export function writeViewerRole(role: ViewerRole, store: StorageLike | null = sessionStore()): void {
  try {
    store?.setItem(VIEWER_ROLE_KEY, role);
  } catch {
    // Storage unavailable: the perspective just won't be remembered on reload.
  }
}
