"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { IconButton } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { TourStep } from "@/lib/viewer/tour";
import { useViewer } from "./viewerContext";

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;

/** Visible, laid-out element for a tour anchor (several elements can share one anchor, e.g. a drawer copy). */
function findTarget(target: string): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`);
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
  }
  return null;
}

/**
 * Guided tour. Each step opens its page (and perspective) first, then waits
 * for its anchor to be visible before highlighting it. If the anchor can't
 * be shown (for example the sidebar on a phone), the step appears without a
 * highlight; the tour never points at something that isn't there.
 */
export default function ViewerTour({ open, steps, startIndex, onClose }: { open: boolean; steps: TourStep[]; startIndex: number; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setRole } = useViewer();
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [settled, setSettled] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    if (open) setIndex(startIndex);
  }, [open, startIndex]);

  // Open the step's page and perspective.
  useEffect(() => {
    if (!open || !step) return;
    setBox(null);
    setSettled(false);
    // The welcome step is centred and stays on whatever page the visitor opened (a deep link keeps working).
    if (index === 0) return;
    if (step.role) setRole(step.role, false);
    if (pathname !== step.path) router.push(step.path);
    // The step, not the pathname, drives navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index]);

  // Wait for the anchor, then keep the highlight on it.
  useEffect(() => {
    if (!open || !step) return;
    if (index !== 0 && pathname !== step.path) return;
    if (!step.target) {
      setSettled(true);
      return;
    }
    let cancelled = false;
    let tries = 0;
    let el: HTMLElement | null = null;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    const find = () => {
      if (cancelled) return;
      el = findTarget(step.target!);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 72 || r.bottom > window.innerHeight - 24) el.scrollIntoView({ block: "center", behavior: "auto" });
        measure();
        setSettled(true);
        return;
      }
      if (++tries > 30) {
        setSettled(true);
        return;
      }
      window.setTimeout(find, 100);
    };
    find();
    const onMove = () => measure();
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    const poll = window.setInterval(measure, 400);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
      window.clearInterval(poll);
    };
  }, [open, index, pathname, step]);

  // Focus the primary button when the step settles; trap Tab; Escape closes.
  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 30);
    return () => window.clearTimeout(t);
  }, [open, index]);

  const go = useCallback(
    (to: number) => setIndex(Math.max(0, Math.min(steps.length - 1, to))),
    [steps.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight" && document.activeElement?.tagName !== "INPUT") {
        if (!last) go(index + 1);
      } else if (e.key === "ArrowLeft" && document.activeElement?.tagName !== "INPUT") {
        go(index - 1);
      } else if (e.key === "Tab") {
        const nodes = cardRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!nodes?.length) return;
        const first = nodes[0];
        const lastEl = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, last, go, onClose]);

  // Return focus to where the visitor was when the tour closes.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      return;
    }
    const el = opener.current;
    if (el && document.contains(el)) el.focus({ preventScroll: true });
    else document.getElementById("main")?.focus({ preventScroll: true });
  }, [open]);

  if (!open || !mounted || !step) return null;

  const placeTop = box ? box.top + box.height / 2 > window.innerHeight * 0.55 : false;
  const number = String(index + 1).padStart(2, "0");
  const total = String(steps.length).padStart(2, "0");

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      {/* Blocks clicks on the page behind the tour; the highlight draws the dimming. */}
      <div aria-hidden="true" className={cn("absolute inset-0", !box && "bg-overlay")} onMouseDown={(e) => e.preventDefault()} />
      {box && <div aria-hidden="true" className="tour-ring pointer-events-none fixed rounded-xl" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} />}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={cn(
          "glass-blur absolute inset-x-3 flex max-h-[70dvh] flex-col rounded-xl animate-dialog-in sm:inset-x-auto sm:right-6 sm:w-[24rem]",
          box ? (placeTop ? "top-3 sm:top-20" : "bottom-3 sm:bottom-6") : "bottom-3 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <p className="tabular font-mono text-xs font-medium text-fg-subtle" aria-label={`Step ${index + 1} of ${steps.length}`}>
            {number} / {total}
          </p>
          <IconButton label="Close the guide" size="sm" onClick={onClose} className="-mr-2">
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>
        <div aria-hidden="true" className="mx-5 mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width] duration-200" style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
          <h2 id="tour-title" className="text-base font-semibold text-fg">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1.5 text-sm leading-relaxed text-fg-muted">
            {step.body}
          </p>
          {!settled && <p className="mt-2 text-xs text-fg-subtle">Opening the page…</p>}
          {step.learnMore && (
            <Link href={step.learnMore.href} onClick={onClose} className="mt-3 inline-block text-[13px] font-medium text-brand-fg hover:underline">
              {step.learnMore.label} →
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-glass-border px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="mr-auto">
            {last ? "Close" : "Skip"}
          </Button>
          {index > 0 && (
            <Button variant="secondary" size="sm" onClick={() => go(index - 1)} icon={<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />}>
              Back
            </Button>
          )}
          <Button ref={nextRef} size="sm" onClick={() => (last ? onClose() : go(index + 1))}>
            {last ? "Finish" : "Next"}
            {!last && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
