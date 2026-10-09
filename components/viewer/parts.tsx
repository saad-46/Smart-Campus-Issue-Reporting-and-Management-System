"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import Card from "@/components/ui/Card";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { Pagination, SortButton } from "@/components/ui/Filters";
import { TableWrap, td, th, trHover } from "@/components/ui/Data";
import { SlaBadgeView } from "@/components/issue/SlaView";
import { computeSla } from "@/lib/intelligence/sla";
import { DemoData, DemoIssue } from "@/lib/viewer/demoData";
import { DemoStats } from "@/lib/viewer/demoStats";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { useViewer } from "./viewerContext";
import type { ViewerContextValue } from "./viewerContext";

export type ReadyViewer = ViewerContextValue & { data: DemoData; stats: DemoStats };

export function ViewerLoading() {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        Loading the demo data
      </span>
      <Skeleton className="mb-2 h-7 w-56" />
      <Skeleton className="mb-6 h-4 w-80 max-w-full" />
      <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/** Renders its children once the demo data exists (it is built in the browser, relative to the visitor's clock). */
export function ViewerGate({ children }: { children: (viewer: ReadyViewer) => React.ReactNode }) {
  const viewer = useViewer();
  if (!viewer.data || !viewer.stats) return <ViewerLoading />;
  return <>{children(viewer as ReadyViewer)}</>;
}

/** One issue in a list; the whole row opens the issue page. */
export function DemoIssueRow({ issue, now, config, showAssignee, action, footer }: { issue: DemoIssue; now: Date; config: ReadyViewer["slaConfig"]; showAssignee?: boolean; action?: React.ReactNode; footer?: React.ReactNode }) {
  const { workerName } = useViewer();
  return (
    // Container query: rows sit in full-width lists and in narrow side cards, so lay out by the row's own width.
    <li className="@container relative px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
      <div className="flex flex-col gap-2 @md:flex-row @md:items-start @md:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">
            <Link
              href={`/viewer/issues/${issue.id}`}
              className="after:absolute after:inset-0 after:content-[''] hover:text-brand-fg focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-brand"
            >
              {issue.title}
            </Link>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] text-fg-subtle">
            <span className="tabular font-mono text-xs">{issue.id}</span>
            <span aria-hidden="true">·</span>
            <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{issue.location}</span>
            <span aria-hidden="true">·</span>
            <span>{formatRelative(issue.createdAt, now)}</span>
            {showAssignee && (
              <>
                <span aria-hidden="true">·</span>
                <span>{issue.assignedTo ? workerName(issue.assignedTo) : "Unassigned"}</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 @md:shrink-0">
          <SlaBadgeView issue={issue} config={config} now={now} compact />
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
        </div>
      </div>
      {/* Above the row's stretched link so it stays clickable. */}
      {action && <div className="relative z-10 mt-2.5">{action}</div>}
      {footer && <div className="relative z-10 mt-2">{footer}</div>}
    </li>
  );
}

export function DemoIssueList({ issues, now, config, label, showAssignee, actionFor, footerFor }: { issues: DemoIssue[]; now: Date; config: ReadyViewer["slaConfig"]; label: string; showAssignee?: boolean; actionFor?: (i: DemoIssue) => React.ReactNode; footerFor?: (i: DemoIssue) => React.ReactNode }) {
  return (
    <ul aria-label={label} className="divide-y divide-border">
      {issues.map((i) => (
        <DemoIssueRow key={i.id} issue={i} now={now} config={config} showAssignee={showAssignee} action={actionFor?.(i)} footer={footerFor?.(i)} />
      ))}
    </ul>
  );
}

type SortKey = "id" | "priority" | "status" | "deadline" | "created";
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const;
const STATUS_RANK = { Open: 0, "In Progress": 1, Resolved: 2 } as const;

/**
 * Sortable, paginated issue table. On phones the same rows become a list
 * (a ten-column table would just be squashed), so nothing is lost.
 */
export function IssueTable({
  issues,
  now,
  config,
  pageSize = 10,
  showAssignee = true,
  label,
  emptyAction,
  tour,
}: {
  issues: DemoIssue[];
  now: Date;
  config: ReadyViewer["slaConfig"];
  pageSize?: number;
  showAssignee?: boolean;
  label: string;
  emptyAction?: React.ReactNode;
  tour?: string;
}) {
  const { workerName } = useViewer();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created", dir: "desc" });
  const [page, setPage] = useState(1);

  const sorted = useMemo(() => {
    const sign = sort.dir === "asc" ? 1 : -1;
    const value = (i: DemoIssue): number | string => {
      switch (sort.key) {
        case "id":
          return i.id;
        case "priority":
          return PRIORITY_RANK[i.priority];
        case "status":
          return STATUS_RANK[i.status];
        case "deadline": {
          const sla = computeSla(i, config, now);
          return i.status === "Resolved" ? Number.MAX_SAFE_INTEGER : sla.remainingMs;
        }
        default:
          return i.createdAt.getTime();
      }
    };
    return [...issues].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sign;
    });
  }, [issues, sort, config, now]);

  // A filter that shrinks the list must not leave the table on an empty page.
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const rows = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggle = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "created" ? "desc" : "asc" }));
    setPage(1);
  };
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");

  if (issues.length === 0) {
    return <EmptyState title="No demo issues match these filters" description="Try clearing one or more filters." action={emptyAction} />;
  }

  return (
    <div data-tour={tour}>
      <div className="hidden md:block">
        <TableWrap label={label}>
          <thead>
            <tr>
              <th scope="col" className={th} aria-sort={ariaSort("id")}>
                <SortButton label="Issue" active={sort.key === "id"} direction={sort.dir} onClick={() => toggle("id")} />
              </th>
              <th scope="col" className={`${th} hidden xl:table-cell`}>
                Category
              </th>
              <th scope="col" className={th} aria-sort={ariaSort("priority")}>
                <SortButton label="Priority" active={sort.key === "priority"} direction={sort.dir} onClick={() => toggle("priority")} />
              </th>
              <th scope="col" className={th} aria-sort={ariaSort("status")}>
                <SortButton label="Status" active={sort.key === "status"} direction={sort.dir} onClick={() => toggle("status")} />
              </th>
              <th scope="col" className={th} aria-sort={ariaSort("deadline")}>
                <SortButton label="Deadline" active={sort.key === "deadline"} direction={sort.dir} onClick={() => toggle("deadline")} />
              </th>
              {showAssignee && (
                <th scope="col" className={th}>
                  Assigned to
                </th>
              )}
              <th scope="col" className={`${th} hidden xl:table-cell`} aria-sort={ariaSort("created")}>
                <SortButton label="Reported" active={sort.key === "created"} direction={sort.dir} onClick={() => toggle("created")} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id} className={cn(trHover, "relative")}>
                <td className={cn(td, "max-w-[22rem]")}>
                  <Link href={`/viewer/issues/${i.id}`} className="block font-medium text-fg after:absolute after:inset-0 after:content-[''] hover:text-brand-fg focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-brand">
                    <span className="line-clamp-1">{i.title}</span>
                  </Link>
                  <span className="mt-0.5 block truncate text-[13px] text-fg-subtle">
                    <span className="tabular font-mono text-xs">{i.id}</span> · {i.location}
                  </span>
                </td>
                <td className={cn(td, "hidden whitespace-nowrap text-fg-muted xl:table-cell")}>{i.category}</td>
                <td className={td}>
                  <PriorityBadge priority={i.priority} />
                </td>
                <td className={td}>
                  <StatusBadge status={i.status} />
                </td>
                <td className={td}>
                  <SlaBadgeView issue={i} config={config} now={now} compact />
                </td>
                {showAssignee && <td className={cn(td, "whitespace-nowrap text-fg-muted")}>{i.assignedTo ? workerName(i.assignedTo) : <span className="text-fg-subtle">Unassigned</span>}</td>}
                <td className={cn(td, "hidden whitespace-nowrap text-fg-muted xl:table-cell")}>{formatRelative(i.createdAt, now)}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </div>
      <div className="md:hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2 text-[13px] text-fg-subtle">
          <label htmlFor="mobile-sort">Sort by</label>
          <select
            id="mobile-sort"
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
              setSort({ key, dir });
              setPage(1);
            }}
            className="h-8 rounded-md border border-border bg-surface px-2 text-[13px] text-fg"
          >
            <option value="created:desc">Newest first</option>
            <option value="created:asc">Oldest first</option>
            <option value="priority:asc">Priority, high first</option>
            <option value="deadline:asc">Deadline, soonest first</option>
            <option value="status:asc">Status</option>
          </select>
        </div>
        <DemoIssueList issues={rows} now={now} config={config} label={label} showAssignee={showAssignee} />
      </div>
      <Pagination page={current} pageSize={pageSize} total={sorted.length} onPage={setPage} className="border-t border-border" />
    </div>
  );
}

/** Numbered steps of a workflow (wraps on small screens). */
export function WorkflowSteps({ steps, label }: { steps: { title: string; text?: string }[]; label: string }) {
  return (
    <ol aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
      {steps.map((s, i) => (
        <li key={s.title} className="glass flex gap-3 rounded-xl p-3">
          <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand-fg" aria-hidden="true">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-fg">{s.title}</p>
            {s.text && <p className="mt-0.5 text-[13px] text-fg-subtle">{s.text}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A titled glass panel with an optional link to the full page. */
export function SectionCard({
  title,
  description,
  href,
  hrefLabel = "View all",
  children,
  className,
  tour,
  id,
  flush,
}: {
  title: string;
  description?: string;
  href?: string;
  hrefLabel?: string;
  children: React.ReactNode;
  className?: string;
  tour?: string;
  id?: string;
  flush?: boolean;
}) {
  return (
    <Card as="section" className={cn("min-w-0 scroll-mt-24", className)} aria-labelledby={`${id ?? title}-h`.replace(/\W+/g, "-")} id={id} data-tour={tour}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 id={`${id ?? title}-h`.replace(/\W+/g, "-")} className="text-[15px] font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-fg-subtle">{description}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-brand-fg hover:underline">
            {hrefLabel}
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className={cn(!flush && "px-4 pb-4 sm:px-5")}>{children}</div>
    </Card>
  );
}
