// ============================================
// Loading, empty and error states
// ============================================

import React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** A placeholder block shaped like the content it stands in for. */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} style={style} />;
}

/** Several text-line skeletons of decreasing width. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3", "w-1/2"];
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", widths[i % widths.length])} />
      ))}
    </div>
  );
}

/** Rows like a list/table while data loads. Announces "Loading" once. */
export function SkeletonRows({ rows = 5, className, label = "Loading" }: { rows?: number; className?: string; label?: string }) {
  return (
    <div className={cn("divide-y divide-border", className)} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className, label = "Loading" }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-fg-subtle", className)}>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ title, description, icon, action, className, compact }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-fg-subtle [&>svg]:h-5 [&>svg]:w-5">
        {icon ?? <Inbox />}
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-subtle">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorState({ title = "Something went wrong", description, onRetry, className, compact }: ErrorStateProps) {
  return (
    <div role="alert" className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-danger-border bg-danger-subtle text-danger">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] text-fg-subtle">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-8 items-center rounded-md border border-border-strong bg-surface px-3 text-[13px] font-medium text-fg transition-colors hover:bg-surface-hover"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Inline banner for page-level notices (not toasts). */
export function Notice({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "border-brand-subtle-border bg-brand-subtle text-fg",
    warning: "border-warning-border bg-warning-subtle text-fg",
    danger: "border-danger-border bg-danger-subtle text-fg",
    success: "border-success-border bg-success-subtle text-fg",
  }[tone];
  const bar = { info: "bg-brand-fg", warning: "bg-warning", danger: "bg-danger", success: "bg-success" }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("relative flex flex-col gap-2 overflow-hidden rounded-lg border py-3 pl-4 pr-3 text-sm sm:flex-row sm:items-center sm:justify-between", styles, className)}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-[3px]", bar)} />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn("text-fg-muted", title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}
