"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, FilePlus2, Link2, Star, UserCheck, Wrench, XCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Tabs";
import { Pagination } from "@/components/ui/Filters";
import { EmptyState } from "@/components/ui/States";
import { ViewerGate } from "@/components/viewer/parts";
import { demoActivity } from "@/lib/viewer/demoFeed";
import { IssueEventType } from "@/types";
import { formatDate, formatRelative, formatTime } from "@/lib/dates";
import { cn } from "@/lib/cn";

const ICONS: Record<IssueEventType, React.ElementType> = {
  reported: FilePlus2,
  claimed: UserCheck,
  assigned: UserCheck,
  started: Wrench,
  resolved: CheckCircle2,
  claim_approved: Banknote,
  claim_rejected: XCircle,
  linked: Link2,
  feedback: Star,
};

const GROUPS: { value: string; label: string; types: IssueEventType[] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "reports", label: "Reports", types: ["reported", "linked"] },
  { value: "work", label: "Work", types: ["assigned", "claimed", "started", "resolved"] },
  { value: "money", label: "Claims", types: ["claim_approved", "claim_rejected"] },
  { value: "feedback", label: "Feedback", types: ["feedback"] },
];

export default function ViewerTimelinePage() {
  const [group, setGroup] = useState("all");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  return (
    <ViewerGate>
      {({ data, role, workerName }) => {
        const all = demoActivity(data, 400, workerName);
        const types = GROUPS.find((g) => g.value === group)!.types;
        const categories = [...new Set(data.issues.map((i) => i.category))].sort();
        const filtered = all.filter((a) => (!types.length || types.includes(a.type)) && (!category || a.issue.category === category) && (role !== "student" || a.issue.mine || a.type === "reported"));
        const pageSize = 15;
        const rows = filtered.slice((page - 1) * pageSize, page * pageSize);

        return (
          <>
            <PageHeader title="Timeline" description="Everything recorded across the campus, newest first. Each entry opens its issue." />
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Segmented
                label="Event type"
                size="sm"
                value={group}
                onChange={(v) => {
                  setGroup(v);
                  setPage(1);
                }}
                options={GROUPS.map((g) => ({ value: g.value, label: g.label }))}
              />
              <Select size="sm" aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} wrapperClassName="w-auto">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </div>
            <Card className="overflow-hidden" data-tour="timeline-feed">
              {rows.length === 0 ? (
                <EmptyState title="No events match" description="Try another event type or category." />
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
                            <Link href={`/viewer/issues/${a.issue.id}`} className="font-medium text-fg-muted after:absolute after:inset-0 after:content-[''] hover:text-brand-fg focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-brand">
                              {a.issue.id} · {a.issue.title}
                            </Link>
                          </p>
                        </div>
                        <time dateTime={a.at.toISOString()} title={`${formatDate(a.at)} ${formatTime(a.at)}`} className="shrink-0 text-xs text-fg-subtle">
                          {formatRelative(a.at, data.now)}
                        </time>
                      </li>
                    );
                  })}
                </ol>
              )}
              <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} className="border-t border-border" />
            </Card>
          </>
        );
      }}
    </ViewerGate>
  );
}
