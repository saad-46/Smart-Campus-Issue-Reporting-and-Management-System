"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, FilePlus2, Link2, Wrench } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Filters";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import { Issue } from "@/types";
import { subscribeToRecentIssues } from "@/lib/firestore";
import { ACTIVITY_GROUPS, ActivityEntry, issueActivity } from "@/lib/activity";
import { ISSUE_CATEGORIES } from "@/lib/constants";
import { formatDate, formatRelative, formatTime } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/cn";

const ICONS: Record<ActivityEntry["type"], React.ElementType> = { reported: FilePlus2, linked: Link2, started: Wrench, resolved: CheckCircle2 };
const PAGE_SIZE = 15;

export default function TimelinePage() {
  const { userProfile, activeRole } = useAuthContext();
  const now = useNow();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [group, setGroup] = useState("all");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setError("");
    return subscribeToRecentIssues(setIssues, (err) => {
      logError("subscribeToRecentIssues", err);
      setError(getFriendlyErrorMessage(err, "We couldn't load the timeline. Please check your connection and try again."));
    });
  }, [retryKey]);

  const all = useMemo(() => (issues && userProfile ? issueActivity(issues, { id: userProfile.id, role: activeRole }) : []), [issues, userProfile, activeRole]);
  const types = ACTIVITY_GROUPS.find((g) => g.value === group)?.types ?? [];
  const filtered = all.filter((a) => (!types.length || types.includes(a.type)) && (!category || a.issue.category === category));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader title="Timeline" description="Recent reports and progress across the campus, newest first. Each entry opens its issue." />
      {error ? (
        <Card>
          <ErrorState title="Couldn't load the timeline" description={error} onRetry={() => setRetryKey((k) => k + 1)} />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Segmented
              label="Event type"
              size="sm"
              value={group}
              onChange={(v) => {
                setGroup(v);
                setPage(1);
              }}
              options={ACTIVITY_GROUPS.map((g) => ({ value: g.value, label: g.label }))}
            />
            <Select
              size="sm"
              aria-label="Category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              wrapperClassName="w-auto"
            >
              <option value="">All categories</option>
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </div>
          <Card className="overflow-hidden">
            {issues === null ? (
              <SkeletonRows rows={6} label="Loading timeline" />
            ) : rows.length === 0 ? (
              <EmptyState title="No events match" description={all.length === 0 ? "Events appear here as issues are reported and worked on." : "Try another event type or category."} />
            ) : (
              <ol aria-label="Campus timeline" className="divide-y divide-border">
                {rows.map((a) => {
                  const Icon = ICONS[a.type];
                  return (
                    <li key={a.id} className="relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
                      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-fg-muted", a.type === "resolved" && "border-success-border bg-success-subtle text-success")}>
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-fg">{a.text}</p>
                        <p className="mt-0.5 truncate text-[13px] text-fg-subtle">
                          <Link href={`/issues/${a.issue.id}`} className="font-medium text-fg-muted after:absolute after:inset-0 after:content-[''] hover:text-brand-fg focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-brand">
                            {a.issue.title}
                          </Link>
                        </p>
                      </div>
                      <time dateTime={a.at.toISOString()} title={`${formatDate(a.at)} ${formatTime(a.at)}`} className="shrink-0 text-xs text-fg-subtle">
                        {formatRelative(a.at, now)}
                      </time>
                    </li>
                  );
                })}
              </ol>
            )}
            {issues !== null && <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} className="border-t border-border" />}
          </Card>
        </>
      )}
    </>
  );
}
