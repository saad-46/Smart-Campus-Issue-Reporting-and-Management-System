"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search as SearchIcon, SearchX } from "lucide-react";
import { IssueStatus, IssueSummary, Priority } from "@/types";
import { fetchIssueSummaries, getIssue } from "@/lib/firestore";
import { ISSUE_CATEGORIES, ISSUE_STATUSES, PRIORITIES, QUERY_LIMITS } from "@/lib/constants";
import { toIssueSummary } from "@/lib/models";
import { searchIssues, SearchFilters } from "@/lib/search";
import { formatDate } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Field";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";

const ISSUE_ID = /^[A-Za-z0-9]{15,40}$/;

export default function SearchPage() {
  const [pool, setPool] = useState<{ issues: IssueSummary[]; capped: boolean } | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [exact, setExact] = useState<IssueSummary | null>(null);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetchIssueSummaries({ max: QUERY_LIMITS.search })
      .then((result) => {
        if (!cancelled) setPool(result);
      })
      .catch((err) => {
        logError("fetchIssueSummaries", err);
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Search isn't available right now."));
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  const hits = useMemo(() => (pool ? searchIssues(pool.issues, query, filters) : []), [pool, query, filters]);

  // An issue ID that isn't among the loaded issues is looked up directly.
  const trimmed = query.trim().replace(/^#/, "");
  const inPool = !!pool?.issues.some((i) => i.id === trimmed);
  useEffect(() => {
    setExact(null);
    if (!ISSUE_ID.test(trimmed) || inPool) return;
    let cancelled = false;
    getIssue(trimmed)
      .then((issue) => {
        if (!cancelled && issue) setExact(toIssueSummary(issue));
      })
      .catch((err) => logError("getIssue", err));
    return () => {
      cancelled = true;
    };
  }, [trimmed, inPool]);

  const results = exact ? [{ issue: exact, score: 100 }, ...hits.filter((h) => h.issue.id !== exact.id)] : hits;
  const setFilter = (key: keyof SearchFilters, value: string) => setFilters((f) => ({ ...f, [key]: value || undefined }));

  return (
    <>
      <PageHeader
        title="Search"
        description={
          <>
            Find issues by ID, title, location or category. Tip: press <kbd className="rounded border border-border bg-surface-2 px-1 text-xs">{isMac ? "⌘K" : "Ctrl K"}</kbd> anywhere to search.
          </>
        }
      />

      <form role="search" onSubmit={(e) => e.preventDefault()} className="mb-4 space-y-3">
        <Input
          type="search"
          aria-label="Search issues"
          icon={<SearchIcon aria-hidden="true" />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. wifi library, Block B, or an issue ID"
          maxLength={120}
          autoFocus
          className="h-10"
        />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          <Select size="sm" aria-label="Status" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value as IssueStatus)} wrapperClassName="w-auto shrink-0">
            <option value="">Any status</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select size="sm" aria-label="Category" value={filters.category ?? ""} onChange={(e) => setFilter("category", e.target.value)} wrapperClassName="w-auto shrink-0">
            <option value="">Any category</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select size="sm" aria-label="Priority" value={filters.priority ?? ""} onChange={(e) => setFilter("priority", e.target.value as Priority)} wrapperClassName="w-auto shrink-0">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </div>
      </form>

      <Card>
        {error ? (
          <ErrorState title="Search unavailable" description={error} onRetry={() => setRetryKey((k) => k + 1)} />
        ) : !pool ? (
          <SkeletonRows rows={6} label="Loading issues" />
        ) : (
          <>
            <p role="status" className="border-b border-border px-4 py-2.5 text-xs text-fg-subtle sm:px-5">
              {results.length === 0
                ? "No results"
                : `${results.length}${results.length === 50 ? "+" : ""} result${results.length === 1 ? "" : "s"}${query.trim() ? "" : " · most recent first"} · searching the ${QUERY_LIMITS.search} most recent issues`}
            </p>
            {results.length === 0 ? (
              <EmptyState icon={<SearchX />} title={`No issues match “${query.trim()}”`} description="Try fewer words, a building name, or a different filter." />
            ) : (
              <ul className="divide-y divide-border">
                {results.map(({ issue }) => (
                  <li key={issue.id}>
                    <Link href={`/issues/${issue.id}`} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium text-fg">{issue.title}</span>
                        <span className="mt-0.5 block text-[13px] text-fg-subtle">
                          {issue.location} · {issue.category} · {formatDate(issue.createdAt)} · <span className="font-mono text-xs">#{issue.id.slice(0, 8)}</span>
                        </span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                        <PriorityBadge priority={issue.priority} />
                        <StatusBadge status={issue.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
    </>
  );
}
