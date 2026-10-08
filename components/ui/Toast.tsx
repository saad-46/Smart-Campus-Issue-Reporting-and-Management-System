"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
  action?: { label: string; onClick: () => void };
  /** Milliseconds; errors stay a little longer by default. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
  tone: ToastTone;
}

interface ToastApi {
  show: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  /** Viewer Mode: the action was simulated and nothing was saved. */
  demo: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />,
  error: <XCircle className="h-4 w-4 text-danger" aria-hidden="true" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />,
  info: <Info className="h-4 w-4 text-brand-fg" aria-hidden="true" />,
};

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration ?? (toast.tone === "error" ? 7000 : 4500));

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, toast.id, onDismiss]);

  return (
    <li
      className="glass-blur pointer-events-auto flex w-full items-start gap-3 rounded-xl p-3 pr-2 animate-toast-in"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="mt-0.5">{ICONS[toast.tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-[13px] text-fg-muted">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="mt-1.5 text-[13px] font-medium text-brand-fg hover:underline"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Toasts: bottom-right on desktop, bottom-centre on phones, never covering
 * navigation. Announced politely (errors assertively); pause on hover/focus.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((input: ToastInput) => {
    const item: ToastItem = { ...input, tone: input.tone ?? "info", id: nextId.current++ };
    setToasts((list) => [...list.slice(-3), item]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, description) => show({ title, description, tone: "success" }),
      error: (title, description) => show({ title, description, tone: "error" }),
      demo: (title, description) => show({ title, description: description ?? "Demo mode — no real data was modified.", tone: "success", duration: 5500 }),
    }),
    [show]
  );

  const errors = toasts.filter((t) => t.tone === "error");
  const others = toasts.filter((t) => t.tone !== "error");

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
        <ol aria-live="polite" aria-label="Status messages" className="flex w-full max-w-sm flex-col gap-2">
          {others.map((t) => (
            <ToastView key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </ol>
        <ol role="alert" aria-live="assertive" className="flex w-full max-w-sm flex-col gap-2">
          {errors.map((t) => (
            <ToastView key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
