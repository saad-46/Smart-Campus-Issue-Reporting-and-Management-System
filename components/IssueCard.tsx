"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, Flame, MapPin, Siren } from "lucide-react";
import { Issue } from "@/types";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import UpvoteButton from "@/components/ui/UpvoteButton";
import SlaBadge from "@/components/issue/SlaBadge";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/cn";

interface IssueRowProps {
  issue: Issue;
  /** "explore" shows the reporter and an upvote control. */
  viewContext?: "my-issues" | "explore";
  /** Show the live SLA state (worker and reporter views). */
  showSla?: boolean;
  /** Extra controls on the right (worker actions). Rendered above the row link. */
  actions?: React.ReactNode;
  /** Additional content under the meta line (e.g. a tip). */
  footer?: React.ReactNode;
  className?: string;
}

/**
 * One issue as a compact, scannable row: title first, then where and when,
 * with status signals on the right. The whole row opens the issue; controls
 * inside it stay independently clickable.
 */
export default function IssueRow({ issue, viewContext = "my-issues", showSla = false, actions, footer, className }: IssueRowProps) {
  const thumb = issue.thumbnails[0];
  const explore = viewContext === "explore";

  return (
    <article className={cn("group relative flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-hover sm:px-5", className)}>
      {thumb ? (
        <img src={thumb} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md border border-border object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="min-w-0 text-sm font-medium text-fg">
            <Link href={`/issues/${issue.id}`} className="break-words outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:underline">
              {issue.title}
            </Link>
          </h3>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {issue.escalated && issue.status !== "Resolved" && (
              <Badge tone="danger" icon={<Siren aria-hidden="true" />}>
                Escalated
              </Badge>
            )}
            {showSla && issue.status !== "Resolved" && <SlaBadge issue={issue} compact />}
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
          </div>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-fg-subtle">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{issue.location}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>{issue.category}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={issue.createdAt.toISOString()}>{formatDate(issue.createdAt)}</time>
          {explore && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">by {issue.createdByName}</span>
            </>
          )}
          {issue.imageCount > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{issue.imageCount} photos</span>
            </>
          )}
        </p>
        {footer && <div className="relative z-10 mt-2">{footer}</div>}
        {(explore || actions) && (
          <div className="relative z-10 mt-2.5 flex flex-wrap items-center gap-2">
            {explore && <UpvoteButton issueId={issue.id} upvotes={issue.upvotes ?? 0} upvotedBy={issue.upvotedBy ?? []} issueTitle={`${issue.title}, ${issue.location}`} />}
            {explore && (issue.upvotes ?? 0) >= 5 && (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <Flame className="h-3.5 w-3.5" aria-hidden="true" /> Many people affected
              </span>
            )}
            {actions}
          </div>
        )}
      </div>
      <ArrowUpRight className="mt-0.5 hidden h-4 w-4 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100 sm:block" aria-hidden="true" />
    </article>
  );
}
