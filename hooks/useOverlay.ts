"use client";

import { RefObject, useEffect, useRef } from "react";

// Open overlays, top-most last. Only the top one reacts to Escape / Tab,
// so a dialog opened from a drawer closes on its own first.
const stack: symbol[] = [];
let lockCount = 0;
let savedOverflow = "";
let savedPadding = "";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hasAttribute("inert") && el.getClientRects().length > 0
  );
}

function lockScroll() {
  if (lockCount++ > 0) return;
  const body = document.body;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  savedOverflow = body.style.overflow;
  savedPadding = body.style.paddingRight;
  body.style.overflow = "hidden";
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
}

function unlockScroll() {
  if (--lockCount > 0) return;
  document.body.style.overflow = savedOverflow;
  document.body.style.paddingRight = savedPadding;
}

/**
 * Modal behaviour for dialogs and drawers: moves focus inside, traps Tab,
 * closes on Escape, locks page scroll, and returns focus to the element
 * that opened it.
 */
export function useOverlay(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  { initialFocus }: { initialFocus?: RefObject<HTMLElement | null> } = {}
) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const id = Symbol("overlay");
    stack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();

    const frame = window.setTimeout(() => {
      const root = ref.current;
      if (!root || root.contains(document.activeElement)) return;
      const target = initialFocus?.current ?? focusables(root)[0] ?? root;
      target.focus({ preventScroll: true });
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const root = ref.current;
      if (!root) return;
      const items = focusables(root);
      if (items.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      window.clearTimeout(frame);
      document.removeEventListener("keydown", onKey);
      const index = stack.indexOf(id);
      if (index >= 0) stack.splice(index, 1);
      unlockScroll();
      // Return focus to the opener; if it's gone (e.g. its row was deleted), to the main region.
      if (previouslyFocused && previouslyFocused !== document.body && document.contains(previouslyFocused)) previouslyFocused.focus({ preventScroll: true });
      else document.getElementById("main")?.focus({ preventScroll: true });
      // Live data can remove the opener just after closing (e.g. a paid claim's row): don't leave focus on <body>.
      window.setTimeout(() => {
        if (document.activeElement === document.body) document.getElementById("main")?.focus({ preventScroll: true });
      }, 400);
    };
    // initialFocus is a ref; reading .current inside the timeout is intended.
  }, [open, ref, initialFocus]);
}
