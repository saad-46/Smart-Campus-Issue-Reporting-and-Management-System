import React from "react";
import { LogoMark } from "./Logo";
import { cn } from "@/lib/cn";

/**
 * Full-page message (access denied, profile unavailable, 404, crash).
 * Calm and centred, with the product mark for orientation.
 */
export default function StatusScreen({
  title,
  description,
  actions,
  code,
  tone = "neutral",
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  code?: string;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div role={tone === "danger" ? "alert" : undefined} className="w-full max-w-sm text-center">
        <LogoMark className="mx-auto mb-6 h-9 w-9" />
        {code && <p className={cn("tabular mb-1 text-sm font-medium", tone === "danger" ? "text-danger" : "text-fg-subtle")}>{code}</p>}
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        {description && <p className="mt-2 text-sm text-fg-muted">{description}</p>}
        {actions && <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{actions}</div>}
      </div>
    </div>
  );
}

/** Neutral app-shaped placeholder while auth/profile load (no spinner wall). */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh" role="status" aria-label="Loading">
      <div className="glass-bar relative hidden w-60 shrink-0 border-r p-4 lg:block">
        <div className="skeleton mb-8 h-7 w-28" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton mb-3 h-6 w-full" />
        ))}
      </div>
      <div className="flex-1">
        <div className="h-14 border-b border-border bg-surface" />
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-4 w-80 max-w-full" />
          <div className="skeleton mt-6 h-24 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
