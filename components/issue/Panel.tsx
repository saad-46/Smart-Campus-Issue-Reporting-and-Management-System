import React from "react";
import { cn } from "@/lib/cn";

/** Bordered section used by the issue-detail side rail. */
export default function Panel({
  title,
  badge,
  action,
  description,
  children,
  labelledBy,
  id,
  className,
  flush = false,
}: {
  title: string;
  /** Small element next to the title (e.g. "Suggestion"). */
  badge?: React.ReactNode;
  action?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  labelledBy?: string;
  id?: string;
  className?: string;
  /** Children manage their own padding (lists). */
  flush?: boolean;
}) {
  const headingId = labelledBy ?? `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section id={id} aria-labelledby={headingId} className={cn("scroll-mt-20 rounded-lg border border-border bg-surface", className)}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-sm font-semibold text-fg">
              {title}
            </h2>
            {badge}
          </div>
          {description && <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn(!flush && "px-4 pb-4")}>{children}</div>
    </section>
  );
}
