"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Globe2, Plus, SearchX } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import IssueRow from "@/components/IssueCard";
import AccountNotices from "@/components/AccountNotices";
import FeedbackRequests from "@/components/FeedbackRequests";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { Tabs, tabId } from "@/components/ui/Tabs";
import { StatStrip } from "@/components/ui/Data";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import Button, { buttonClasses } from "@/components/ui/Button";
import { Issue } from "@/types";
import { subscribeToUserIssues, subscribeToRecentIssues } from "@/lib/firestore";
import { ISSUE_CATEGORIES, ISSUE_STATUSES } from "@/lib/constants";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { greeting } from "@/lib/dates";

const STATUS_ORDER: Record<string, number> = { "In Progress": 0, Open: 1, Resolved: 2 };
type Tab = "my-issues" | "explore";

const LOAD_ERROR = "We couldn't load issues right now. Please check your connection and try again.";

function DashboardContent() {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  // The report form has its own page now; keep old links working.
  useEffect(() => {
    if (tabParam === "report") router.replace("/dashboard/report");
  }, [tabParam, router]);

  const tab: Tab = tabParam === "explore" ? "explore" : "my-issues";
  const setTab = (next: Tab) => router.replace(next === "explore" ? "/dashboard?tab=explore" : "/dashboard", { scroll: false });

  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // null = still loading
  const [myIssues, setMyIssues] = useState<Issue[] | null>(null);
  const [exploreIssues, setExploreIssues] = useState<Issue[] | null>(null);
  const [myError, setMyError] = useState("");
  const [exploreError, setExploreError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  // The user's own issues: one listener for the lifetime of the page.
  useEffect(() => {
    if (!userProfile?.id) return;
    setMyError("");
    return subscribeToUserIssues(userProfile.id, setMyIssues, (err) => {
      logError("subscribeToUserIssues", err);
      setMyError(getFriendlyErrorMessage(err, LOAD_ERROR));
    });
  }, [userProfile?.id, retryKey]);

  // The community feed is only fetched while its tab is open.
  const exploring = tab === "explore";
  useEffect(() => {
    if (!userProfile?.id || !exploring) return;
    setExploreError("");
    return subscribeToRecentIssues(setExploreIssues, (err) => {
      logError("subscribeToRecentIssues", err);
      setExploreError(getFriendlyErrorMessage(err, LOAD_ERROR));
    });
  }, [userProfile?.id, exploring, retryKey]);

  const source = exploring ? exploreIssues : myIssues;
  const loadError = exploring ? exploreError : myError;
  const loading = source === null && !loadError;
  const data = useMemo(() => source ?? [], [source]);

  const filtered = useMemo(() => {
    const base = data.filter((i) => (!categoryFilter || i.category === categoryFilter) && (!statusFilter || i.status === statusFilter));
    if (exploring) return [...base].sort((a, b) => b.upvotes - a.upvotes || b.createdAt.getTime() - a.createdAt.getTime());
    return [...base].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.createdAt.getTime() - a.createdAt.getTime());
  }, [data, categoryFilter, statusFilter, exploring]);

  const mine = myIssues ?? [];
  const counts = {
    open: mine.filter((i) => i.status === "Open").length,
    progress: mine.filter((i) => i.status === "In Progress").length,
    resolved: mine.filter((i) => i.status === "Resolved").length,
  };
  const hasFilters = !!categoryFilter || !!statusFilter;
  const clearFilters = () => {
    setCategoryFilter("");
    setStatusFilter("");
  };
  const firstName = userProfile?.name?.split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow={firstName ? `${greeting()}, ${firstName}` : undefined}
        title={exploring ? "Community" : "My issues"}
        description={exploring ? "Recent issues reported across campus. Vote on the ones that affect you too." : "Track what you've reported, from submitted to resolved."}
        actions={
          <Link href="/dashboard/report" className={buttonClasses("primary")}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Report an issue
          </Link>
        }
      />

      <AccountNotices />

      {!exploring && userProfile && myIssues && <FeedbackRequests userId={userProfile.id} myIssues={myIssues} />}

      {!exploring && (
        <StatStrip
          className="mb-6 lg:grid-cols-3"
          stats={[
            { label: "Open", value: counts.open, loading: myIssues === null, hint: "Waiting to be picked up" },
            { label: "In progress", value: counts.progress, loading: myIssues === null, hint: "A worker is on it" },
            { label: "Resolved", value: counts.resolved, loading: myIssues === null, hint: "Marked as fixed" },
          ]}
        />
      )}

      <Card>
        <div className="flex flex-col gap-3 px-4 pt-2 sm:px-5 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="sr-only">Issue lists</h2>
          <Tabs
            label="Issue lists"
            value={tab}
            onChange={setTab}
            panelId="issues-panel"
            className="border-b-0"
            options={[
              { value: "my-issues", label: "My issues", count: myIssues?.length },
              { value: "explore", label: "Community" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 pb-3 lg:pb-2">
            <Select size="sm" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} wrapperClassName="w-auto">
              <option value="">All statuses</option>
              {ISSUE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select size="sm" aria-label="Filter by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} wrapperClassName="w-auto">
              <option value="">All categories</option>
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="border-t border-border" id="issues-panel" role="tabpanel" aria-labelledby={tabId("issues-panel", tab)}>
          {loadError ? (
            <ErrorState title="Couldn't load issues" description={loadError} onRetry={() => setRetryKey((k) => k + 1)} />
          ) : loading ? (
            <SkeletonRows rows={5} label="Loading issues" />
          ) : data.length === 0 ? (
            exploring ? (
              <EmptyState icon={<Globe2 />} title="No issues reported yet" description="When people report problems around campus, they'll appear here." />
            ) : (
              <EmptyState
                icon={<ClipboardList />}
                title="You haven't reported anything yet"
                description="Spotted something broken, unsafe or unclean? Report it and follow it until it's fixed."
                action={
                  <Link href="/dashboard/report" className={buttonClasses("primary")}>
                    <Plus className="h-4 w-4" aria-hidden="true" /> Report an issue
                  </Link>
                }
              />
            )
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="No issues match these filters"
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-border">
                {filtered.map((issue) => (
                  <li key={issue.id}>
                    <IssueRow issue={issue} viewContext={exploring ? "explore" : "my-issues"} showSla={!exploring} />
                  </li>
                ))}
              </ul>
              <p className="border-t border-border px-4 py-2.5 text-xs text-fg-subtle sm:px-5">
                {filtered.length} of {data.length} · sorted by {exploring ? "votes, then newest" : "status, then newest"}
                {exploring && " · most recent 100 issues"}
              </p>
            </>
          )}
        </div>
      </Card>
    </>
  );
}

export default function UserDashboardPage() {
  return (
    // useSearchParams() needs a Suspense boundary for the production build
    <Suspense fallback={<SkeletonRows rows={6} />}>
      <DashboardContent />
    </Suspense>
  );
}
