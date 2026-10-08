// ============================================
// Shell preferences (this browser only)
// ============================================
// Remembers whether the desktop sidebar is collapsed. localStorage can be
// blocked (private windows, strict settings); then the default applies.

export const SIDEBAR_KEY = "smart-campus-sidebar-collapsed";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function storage(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readSidebarCollapsed(store: StorageLike | null = storage()): boolean {
  try {
    return store?.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeSidebarCollapsed(collapsed: boolean, store: StorageLike | null = storage()): void {
  try {
    store?.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage unavailable: the preference just won't persist.
  }
}
