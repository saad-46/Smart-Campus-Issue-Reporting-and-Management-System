"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search as SearchIcon, SearchX, SlidersHorizontal } from "lucide-react";
import { Issue, User } from "@/types";
import { ADMIN_ISSUE_WINDOW, subscribeToRecentIssues } from "@/lib/firestore";
import { getAllWorkers } from "@/lib/finance";
import { ISSUE_CATEGORIES, ISSUE_STATUSES, PRIORITIES } from "@/lib/constants";
import { BUILDINGS, buildingForIssue, getBuilding } from "@/lib/campus";
import { computeSla } from "@/lib/intelligence/sla";
import { formatDate } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { useNow } from "@/hooks/useNow";
import { useCampusLocations } from "@/hooks/useCampusLocations";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Tabs";
import { TableWrap, td, th } from "@/components/ui/Data";
import { EmptyState, ErrorState, SkeletonRows } from "@/components/ui/States";
import SlaBadge from "@/components/issue/SlaBadge";

interface Filters {
  status: string;
  priority: string;
  category: string;
  building: string;
  assignment: "" | "assigned" | "unassigned";
}

const EMPTY: Filters = { status: "", priority: "", category: "", building: "", assignment: "" };

function FilterFields({ filters, setFilters }: { filters: Filters; setFilters: React.Dispatch<React.SetStateAction<Filters>> }) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement>) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  return (
    <>
      <Select size="sm" label="Status" value={filters.status} onChange={set("status")}>
        <option value="">All</option>
        {ISSUE_STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <Select size="sm" label="Priority" value={filters.priority} onChange={set("priority")}>
        <option value="">All</option>
        {PRIORITIES.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </Select>
      <Select size="sm" label="Category" value={filters.category} onChange={set("category")}>
        <option value="">All</option>
        {ISSUE_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <Select size="sm" label="Building" value={filters.building} onChange={set("building")}>
        <option value="">All</option>
        {BUILDINGS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
      <Select size="sm" label="Assignment" value={filters.assignment} onChange={set("assignment")}>
        <option value="">All</option>
        <option value="unassigned">Unassigned</option>
        <option value="assigned">Assigned</option>
      </Select>
    </>
  );
}

function IssuesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const slaConfig = useSlaConfig();
  const now = useNow();
  const { buildingMap } = useCampusLocations();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [workers, setWorkers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"all" | "attention">(params.get("view") === "attention" ? "attention" : "all");
  const [sort, setSort] = useState<"newest" | "deadline">("newest");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, building: params.get("building") ?? "" });
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    setError("");
    return subscribeToRecentIssues(
      setIssues,
      (err) => {
        logError("subscribeToRecentIssues", err);
        setError(getFriendlyErrorMessage(err, "Issues couldn't be loaded."));
      },
      ADMIN_ISSUE_WINDOW
    );
  }, [retryKey]);

  useEffect(() => {
    getAllWorkers()
      .then(setWorkers)
      .catch((err) => logError("getAllWorkers", err));
  }, []);

  const workerNames = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (issues ?? [])
      .map((issue) => ({ issue, sla: computeSla(issue, slaConfig, now) }))
      .filter(({ issue, sla }) => {
        if (view === "attention" && !(issue.status !== "Resolved" && (issue.escalated || sla.state === "approaching" || sla.state === "breached"))) return false;
        if (filters.status && issue.status !== filters.status) return false;
        if (filters.priority && issue.priority !== filters.priority) return false;
        if (filters.category && issue.category !== filters.category) return false;
        if (filters.assignment === "assigned" && !issue.assignedTo) return false;
        if (filters.assignment === "unassigned" && issue.assignedTo) return false;
        if (filters.building && buildingForIssue(issue, buildingMap)?.id !== filters.building) return false;
        if (q && !`${issue.title} ${issue.location} ${issue.id}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) =>
        sort === "deadline"
          ? Number(a.issue.status === "Resolved") - Number(b.issue.status === "Resolved") || a.sla.remainingMs - b.sla.remainingMs
          : b.issue.createdAt.getTime() - a.issue.createdAt.getTime()
      );
  }, [issues, slaConfig, now, view, filters, query, sort, buildingMap]);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const attentionCount = useMemo(
    () => (issues ?? []).filter((i) => i.status !== "Resolved" && (i.escalated || ["approaching", "breached"].includes(computeSla(i, slaConfig, now).state))).length,
    [issues, slaConfig, now]
  );
  const clearAll = () => {
    setFilters(EMPTY);
    setQuery("");
    if (params.get("building")) router.replace("/admin/issues");
  };

  return (
    <>
      <PageHeader
        title="Issues"
        description={`The ${ADMIN_ISSUE_WINDOW} most recent issues, updated live. Filter, sort by deadline, and open any issue to assign or escalate it.`}
        actions={
          <Segmented
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "all", label: "All" },
              { value: "attention", label: `Needs attention${issues ? ` (${attentionCount})` : ""}` },
            ]}
          />
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:p-4 lg:flex-row lg:items-end">
          <Input
            type="search"
            aria-label="Filter by title, location or ID"
            placeholder="Filter by title, location or ID"
            icon={<SearchIcon aria-hidden="true" />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            wrapperClassName="lg:max-w-xs"
          />
          <div className="hidden flex-1 grid-cols-5 gap-2 lg:grid">
            <FilterFields filters={filters} setFilters={setFilters} />
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <Button variant="secondary" size="sm" icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setFiltersOpen(true)}>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
            <Select size="sm" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as "newest" | "deadline")} wrapperClassName="w-auto">
              <option value="newest">Newest first</option>
              <option value="deadline">Deadline first</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs text-fg-subtle sm:px-5">
          <span role="status">
            {issues ? `${rows.length} of ${issues.length} issues` : "Loading…"}
            {filters.building && ` · ${getBuilding(filters.building)?.name ?? ""}`}
          </span>
          <div className="flex items-center gap-3">
            {(activeFilterCount > 0 || query) && (
              <button type="button" onClick={clearAll} className="font-medium text-brand-fg hover:underline">
                Clear filters
              </button>
            )}
            <label className="hidden items-center gap-1.5 lg:flex">
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "deadline")} className="rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-fg">
                <option value="newest">Newest first</option>
                <option value="deadline">Deadline first</option>
              </select>
            </label>
          </div>
        </div>

        {error ? (
          <ErrorState title="Couldn't load issues" description={error} onRetry={() => setRetryKey((k) => k + 1)} />
        ) : issues === null ? (
          <SkeletonRows rows={8} label="Loading issues" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={view === "attention" && activeFilterCount === 0 && !query ? "Nothing needs attention" : "No issues match"}
            description={view === "attention" && activeFilterCount === 0 && !query ? "Every open issue is within its target time." : "Try removing a filter."}
            action={activeFilterCount > 0 || query ? <Button size="sm" variant="secondary" onClick={clearAll}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            {/* Desktop table */}
            <TableWrap className="hidden md:block" label="Issues table">
              <thead>
                <tr>
                  <th className={th}>Issue</th>
                  <th className={th}>Status</th>
                  <th className={th}>Priority</th>
                  <th className={th}>Deadline</th>
                  <th className={th}>Assignee</th>
                  <th className={`${th} text-right`}>Reported</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ issue }) => (
                  <tr
                    key={issue.id}
                    className="group cursor-pointer transition-colors hover:bg-surface-hover"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a")) return;
                      router.push(`/issues/${issue.id}`);
                    }}
                  >
                    <td className={`${td} max-w-[22rem]`}>
                      <Link href={`/issues/${issue.id}`} className="block truncate font-medium text-fg group-hover:text-brand-fg">
                        {issue.title}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-fg-subtle">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {issue.location} · {issue.category}
                        {issue.escalated && issue.status !== "Resolved" && (
                          <Badge tone="danger" className="ml-1">
                            Escalated
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className={td}>
                      <StatusBadge status={issue.status} />
                    </td>
                    <td className={td}>
                      <PriorityBadge priority={issue.priority} />
                    </td>
                    <td className={td}>
                      <SlaBadge issue={issue} compact />
                    </td>
                    <td className={`${td} max-w-[10rem] truncate text-fg-muted`}>
                      {issue.assignedTo ? workerNames.get(issue.assignedTo) ?? "Staff" : <span className="text-fg-subtle">Unassigned</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right text-fg-muted`}>{formatDate(issue.createdAt, { month: "short", day: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>

            {/* Mobile list */}
            <ul className="divide-y divide-border border-t border-border md:hidden">
              {rows.map(({ issue }) => (
                <li key={issue.id}>
                  <Link href={`/issues/${issue.id}`} className="block px-4 py-3 transition-colors hover:bg-surface-hover">
                    <p className="text-sm font-medium text-fg">{issue.title}</p>
                    <p className="mt-0.5 truncate text-xs text-fg-subtle">
                      {issue.location} · {issue.assignedTo ? workerNames.get(issue.assignedTo) ?? "Staff" : "Unassigned"} · {formatDate(issue.createdAt, { month: "short", day: "numeric" })}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusBadge status={issue.status} />
                      <PriorityBadge priority={issue.priority} />
                      {issue.status !== "Resolved" && <SlaBadge issue={issue} compact />}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        side="bottom"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setFilters(EMPTY)}>
              Reset
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show {rows.length} issues
            </Button>
          </>
        }
      >
        <div className="grid gap-4 p-4">
          <FilterFields filters={filters} setFilters={setFilters} />
        </div>
      </Drawer>
    </>
  );
}

export default function AdminIssuesPage() {
  return (
    <Suspense fallback={<SkeletonRows rows={8} />}>
      <IssuesContent />
    </Suspense>
  );
}
