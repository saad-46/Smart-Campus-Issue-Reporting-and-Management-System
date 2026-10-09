"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, ChevronDown, Download, Loader2, SlidersHorizontal } from "lucide-react";
import { Feedback, IssueStatus, IssueSummary, Priority, User } from "@/types";
import { fetchIssueSummaries } from "@/lib/firestore";
import { getAllWorkers } from "@/lib/finance";
import { getRecentFeedback, summarizeSatisfaction } from "@/lib/feedback";
import { DEPARTMENTS, ISSUE_CATEGORIES, ISSUE_STATUSES, PRIORITIES, departmentFor } from "@/lib/constants";
import { BUILDINGS, buildingForIssue } from "@/lib/campus";
import {
  AnalyticsFilters,
  applyFilters,
  categoryDistribution,
  granularityFor,
  hotspots,
  priorityCounts,
  resolutionByCategory,
  resolutionStats,
  slaSummary,
  statusCounts,
  timeSeries,
  workerWorkload,
} from "@/lib/intelligence/analytics";
import { computeSla, SLA_LABELS } from "@/lib/intelligence/sla";
import { maintenanceRisk } from "@/lib/intelligence/maintenance";
import { RANGE_LABELS, RangePreset, resolveRange, toDateInput } from "@/lib/intelligence/ranges";
import { Column, downloadText, isoOrEmpty, toCsv, toJson } from "@/lib/export";
import { formatDate } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { useCampusLocations } from "@/hooks/useCampusLocations";
import { useChartTheme } from "@/hooks/useChartTheme";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import Menu from "@/components/ui/Menu";
import { Input, Select } from "@/components/ui/Field";
import { StatStrip, TableWrap, td, th } from "@/components/ui/Data";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { formatHours } from "@/components/admin/Kpi";

function stamp(): string {
  return toDateInput(new Date());
}

function FilterFields({
  filters,
  setFilter,
  workers,
}: {
  filters: AnalyticsFilters;
  setFilter: (key: keyof AnalyticsFilters, value: string) => void;
  workers: User[];
}) {
  return (
    <>
      <Select size="sm" label="Campus place" value={filters.buildingId ?? ""} onChange={(e) => setFilter("buildingId", e.target.value)}>
        <option value="">All places</option>
        {BUILDINGS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>
      <Select size="sm" label="Category" value={filters.category ?? ""} onChange={(e) => setFilter("category", e.target.value)}>
        <option value="">All categories</option>
        {ISSUE_CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>
      <Select size="sm" label="Status" value={filters.status ?? ""} onChange={(e) => setFilter("status", e.target.value as IssueStatus)}>
        <option value="">All statuses</option>
        {ISSUE_STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Select>
      <Select size="sm" label="Priority" value={filters.priority ?? ""} onChange={(e) => setFilter("priority", e.target.value as Priority)}>
        <option value="">All priorities</option>
        {PRIORITIES.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </Select>
      <Select size="sm" label="Worker" value={filters.workerId ?? ""} onChange={(e) => setFilter("workerId", e.target.value)}>
        <option value="">All workers</option>
        {workers.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </Select>
      <Select size="sm" label="Department" value={filters.department ?? ""} onChange={(e) => setFilter("department", e.target.value)}>
        <option value="">All departments</option>
        {DEPARTMENTS.map((d) => (
          <option key={d}>{d}</option>
        ))}
      </Select>
    </>
  );
}

export default function AdminAnalyticsPage() {
  const slaConfig = useSlaConfig();
  const chart = useChartTheme();
  const toast = useToast();
  const { buildingMap, nameMap } = useCampusLocations();
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [custom, setCustom] = useState({ from: toDateInput(new Date(Date.now() - 30 * 86_400_000)), to: toDateInput(new Date()) });
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<{ issues: IssueSummary[]; capped: boolean; range: { from: Date; to: Date } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [workers, setWorkers] = useState<User[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [now] = useState(() => new Date());

  // Stable identity until the preset or custom dates change, so it can drive the fetch.
  const range = useMemo(() => resolveRange(preset, now, custom), [preset, now, custom]);

  useEffect(() => {
    getAllWorkers()
      .then(setWorkers)
      .catch((err) => logError("getAllWorkers", err));
    getRecentFeedback()
      .then(setFeedback)
      .catch((err) => logError("getRecentFeedback", err));
  }, []);

  useEffect(() => {
    if ("error" in range) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchIssueSummaries({ since: range.from, until: range.to })
      .then((result) => {
        if (!cancelled) setData({ ...result, range });
      })
      .catch((err) => {
        logError("fetchIssueSummaries", err);
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Analytics data couldn't be loaded."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, retryKey]);

  const workerNames = useMemo(() => new Map(workers.map((w) => [w.id, w.name])), [workers]);
  const issues = useMemo(() => applyFilters(data?.issues ?? [], filters, buildingMap), [data, filters, buildingMap]);
  const from = data?.range.from ?? now;
  const to = data?.range.to ?? now;

  const stats = useMemo(() => {
    const status = statusCounts(issues);
    const priority = priorityCounts(issues);
    const resolution = resolutionStats(issues);
    const sla = slaSummary(issues, slaConfig, to);
    const closed = sla.counts.met + sla.counts.missed;
    return {
      status,
      priority,
      resolution,
      sla,
      slaMetRate: closed ? Math.round((sla.counts.met / closed) * 100) : null,
      series: timeSeries(issues, from, to, granularityFor(from, to)),
      categories: categoryDistribution(issues),
      byCategory: resolutionByCategory(issues),
      places: hotspots(issues, buildingMap),
      workload: workerWorkload(issues).sort((a, b) => b.active + b.resolved - (a.active + a.resolved)),
      risk: maintenanceRisk(data?.issues ?? [], to, buildingMap, nameMap),
    };
  }, [issues, slaConfig, from, to, buildingMap, nameMap, data]);

  const rangeFeedback = useMemo(() => {
    const ids = new Set(issues.map((i) => i.id));
    return feedback.filter((f) => ids.has(f.issueId));
  }, [feedback, issues]);
  const satisfaction = useMemo(() => summarizeSatisfaction(rangeFeedback), [rangeFeedback]);

  const setFilter = (key: keyof AnalyticsFilters, value: string) => setFilters((f) => ({ ...f, [key]: value || undefined }));
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // ---------- exports (no reporter identities) ----------
  const issueColumns: Column<IssueSummary>[] = [
    { header: "id", value: (i) => i.id },
    { header: "title", value: (i) => i.title },
    { header: "category", value: (i) => i.category },
    { header: "department", value: (i) => departmentFor(i.category) },
    { header: "priority", value: (i) => i.priority },
    { header: "status", value: (i) => i.status },
    { header: "location", value: (i) => i.location },
    { header: "building", value: (i) => buildingForIssue(i, buildingMap)?.name ?? "" },
    { header: "assigned_worker", value: (i) => (i.assignedTo ? workerNames.get(i.assignedTo) ?? "staff" : "") },
    { header: "incident_master_id", value: (i) => i.duplicateOf },
    { header: "created_at", value: (i) => isoOrEmpty(i.createdAt) },
    { header: "resolved_at", value: (i) => isoOrEmpty(i.resolvedAt) },
    { header: "sla_state", value: (i) => SLA_LABELS[computeSla(i, slaConfig, to).state] },
  ];

  const exportFile = (name: string, label: string, csv: string, json: string, format: "csv" | "json") => {
    if (format === "csv") downloadText(`unifix-${name}-${stamp()}.csv`, csv, "text/csv");
    else downloadText(`unifix-${name}-${stamp()}.json`, json, "application/json");
    toast.success(`${label} exported`, `Saved as ${format.toUpperCase()}.`);
  };

  const exporters: Record<string, { label: string; run: (format: "csv" | "json") => void }> = {
    issues: { label: "Issues", run: (f) => exportFile("issues", "Issues", toCsv(issues, issueColumns), toJson(issues, issueColumns), f) },
    workload: {
      label: "Worker workload",
      run: (f) => {
        const cols: Column<(typeof stats.workload)[number]>[] = [
          { header: "worker", value: (w) => workerNames.get(w.workerId) ?? "admin / former worker" },
          { header: "active", value: (w) => w.active },
          { header: "resolved", value: (w) => w.resolved },
          { header: "avg_resolution_hours", value: (w) => w.averageResolutionHours },
        ];
        exportFile("workload", "Worker workload", toCsv(stats.workload, cols), toJson(stats.workload, cols), f);
      },
    },
    sla: {
      label: "Deadlines (SLA)",
      run: (f) => {
        const rows = issues.map((i) => ({ issue: i, sla: computeSla(i, slaConfig, to) }));
        const cols: Column<(typeof rows)[number]>[] = [
          { header: "id", value: (r) => r.issue.id },
          { header: "title", value: (r) => r.issue.title },
          { header: "priority", value: (r) => r.issue.priority },
          { header: "status", value: (r) => r.issue.status },
          { header: "target_hours", value: (r) => slaConfig.hours[r.issue.priority] },
          { header: "deadline", value: (r) => isoOrEmpty(r.sla.deadline) },
          { header: "sla_state", value: (r) => SLA_LABELS[r.sla.state] },
        ];
        exportFile("sla", "Deadlines", toCsv(rows, cols), toJson(rows, cols), f);
      },
    },
    feedback: {
      label: "Feedback ratings",
      run: (f) => {
        // Ratings only — no reporter ids or free-text comments.
        const cols: Column<Feedback>[] = [
          { header: "issue_id", value: (x) => x.issueId },
          { header: "category", value: (x) => x.category },
          { header: "worker", value: (x) => (x.assignedTo ? workerNames.get(x.assignedTo) ?? "staff" : "") },
          { header: "rating", value: (x) => x.rating },
          { header: "rated_at", value: (x) => isoOrEmpty(x.createdAt) },
        ];
        exportFile("feedback", "Feedback ratings", toCsv(rangeFeedback, cols), toJson(rangeFeedback, cols), f);
      },
    },
    maintenance: {
      label: "Maintenance risk",
      run: (f) => {
        const rows = stats.risk.sufficient ? stats.risk.indicators : [];
        const cols: Column<(typeof rows)[number]>[] = [
          { header: "place", value: (r) => r.label },
          { header: "risk_level", value: (r) => r.level },
          { header: "score", value: (r) => r.score },
          { header: "issues_90d", value: (r) => r.issuesInWindow },
          { header: "issues_30d", value: (r) => r.issuesLast30Days },
          { header: "repeated_category", value: (r) => r.repeatedCategory },
          { header: "repeated_count", value: (r) => r.repeatedCount },
          { header: "days_since_last", value: (r) => r.daysSinceLastIssue },
        ];
        exportFile("maintenance-risk", "Maintenance risk", toCsv(rows, cols), toJson(rows, cols), f);
      },
    },
  };

  const tooltipProps = { contentStyle: chart.tooltip, labelStyle: chart.tooltipLabel, itemStyle: chart.tooltipItem, cursor: { fill: chart.cursor } };
  const axisTick = { fontSize: 11, fill: chart.axis };
  const showData = data && issues.length > 0;
  const statusColors: Record<IssueStatus, string> = { Open: chart.primary, "In Progress": chart.warning, Resolved: chart.secondary };
  const priorityColors: Record<Priority, string> = { High: chart.danger, Medium: chart.warning, Low: chart.neutral };

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Trends, resolution performance and satisfaction, computed from recorded issues."
        actions={
          <>
            <Select size="md" aria-label="Date range" value={preset} onChange={(e) => setPreset(e.target.value as RangePreset)} wrapperClassName="w-44">
              {(Object.keys(RANGE_LABELS) as RangePreset[]).map((p) => (
                <option key={p} value={p}>
                  {RANGE_LABELS[p]}
                </option>
              ))}
            </Select>
            <Menu
              align="right"
              sections={Object.values(exporters).map((e) => ({
                label: e.label,
                items: [
                  { label: "Download CSV", onSelect: () => e.run("csv") },
                  { label: "Download JSON", onSelect: () => e.run("json") },
                ],
              }))}
              header={<p className="text-xs text-fg-subtle">Uses the current range and filters. No reporter names, emails or comments.</p>}
              trigger={(props) => (
                <Button {...props} variant="secondary" icon={<Download className="h-4 w-4" aria-hidden="true" />} disabled={!data}>
                  Export
                  <ChevronDown className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                </Button>
              )}
            />
          </>
        }
      />

      {preset === "custom" && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Input label="From" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} wrapperClassName="w-44" />
          <Input label="To" type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} wrapperClassName="w-44" />
          {"error" in range && <p role="alert" className="pb-2 text-[13px] text-danger">{range.error}</p>}
        </div>
      )}

      <Card className="mb-6">
        <div className="hidden grid-cols-6 gap-3 p-4 lg:grid">
          <FilterFields filters={filters} setFilter={setFilter} workers={workers} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-[13px] text-fg-subtle first:border-t-0 lg:border-t">
          <span role="status" className="flex items-center gap-2">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
            {data ? (
              <>
                {formatDate(data.range.from)} – {formatDate(data.range.to)} · <span className="tabular font-medium text-fg">{issues.length}</span> issue{issues.length === 1 ? "" : "s"}
                {activeFilterCount > 0 && ` (filtered from ${data.issues.length})`}
                {data.capped && ` · newest ${data.issues.length} in range (query limit)`}
              </>
            ) : (
              "Loading…"
            )}
          </span>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button type="button" onClick={() => setFilters({})} className="font-medium text-brand-fg hover:underline">
                Clear filters
              </button>
            )}
            <Button size="sm" variant="secondary" className="lg:hidden" icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setFiltersOpen(true)}>
              Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <Card>
          <ErrorState title="Couldn't load analytics" description={error} onRetry={() => setRetryKey((k) => k + 1)} />
        </Card>
      ) : !data ? (
        <div className="space-y-6" role="status" aria-label="Loading analytics">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      ) : (
        <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <StatStrip
            className="mb-6"
            stats={[
              { label: "Reported", value: issues.length },
              { label: "Resolved", value: stats.status.Resolved, hint: issues.length ? `${Math.round((stats.status.Resolved / issues.length) * 100)}% of reported` : undefined },
              { label: "Open", value: stats.status.Open + stats.status["In Progress"], hint: `${stats.status["In Progress"]} in progress` },
              { label: "Avg. resolution", value: formatHours(stats.resolution.averageHours) ?? "—", hint: stats.resolution.count ? `Median ${formatHours(stats.resolution.medianHours)}` : "No resolved issues" },
              {
                label: "On time",
                value: stats.slaMetRate !== null ? `${stats.slaMetRate}%` : "—",
                hint: stats.slaMetRate !== null ? `${stats.sla.counts.met} of ${stats.sla.counts.met + stats.sla.counts.missed} resolved` : "No resolved issues",
                tone: stats.slaMetRate !== null && stats.slaMetRate < 60 ? "warning" : "default",
              },
              { label: "Satisfaction", value: satisfaction.average !== null ? `${satisfaction.average}/5` : "—", hint: satisfaction.count ? `${satisfaction.count} ratings` : "No ratings in range" },
            ]}
          />

          {!showData ? (
            <Card>
              <EmptyState icon={<BarChart3 />} title="Not enough data yet" description="No issues match this range and these filters. Try a longer range or remove a filter." />
            </Card>
          ) : (
            <div className="space-y-6">
              <Card>
                <CardHeader title="Issues over time" description={`Reported and resolved per ${granularityFor(from, to)}`} />
                <CardBody>
                  <div className="h-64" role="img" aria-label={`Issues over time: ${issues.length} reported, ${stats.status.Resolved} resolved`}>
                    <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
                      <AreaChart accessibilityLayer={false} data={stats.series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke={chart.grid} vertical={false} />
                        <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: chart.grid }} minTickGap={24} />
                        <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={40} />
                        <Tooltip {...tooltipProps} cursor={{ stroke: chart.grid }} />
                        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Area type="monotone" dataKey="reported" name="Reported" stroke={chart.primary} strokeWidth={2} fill={chart.primarySoft} activeDot={{ r: 4 }} />
                        <Area type="monotone" dataKey="resolved" name="Resolved" stroke={chart.secondary} strokeWidth={2} fill="transparent" activeDot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Resolution performance" description="Average time to resolve, by category" />
                  <CardBody>
                    {stats.byCategory.length === 0 ? (
                      <EmptyState compact title="No resolved issues in this range" />
                    ) : (
                      <div style={{ height: Math.max(160, stats.byCategory.length * 34) }} role="img" aria-label="Average resolution time by category">
                        <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
                          <BarChart accessibilityLayer={false} data={stats.byCategory} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke={chart.grid} horizontal={false} />
                            <XAxis type="number" tick={axisTick} tickLine={false} axisLine={false} unit="h" />
                            <YAxis type="category" dataKey="name" width={96} tick={axisTick} tickLine={false} axisLine={false} />
                            <Tooltip {...tooltipProps} formatter={(v, _n, item) => [`${v}h · ${(item?.payload as { count?: number })?.count ?? 0} resolved`, "Average"]} />
                            <Bar dataKey="averageHours" name="Average hours" fill={chart.primary} radius={[0, 3, 3, 0]} barSize={16} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Categories" description="Reported issues by category" />
                  <CardBody>
                    <div style={{ height: Math.max(160, stats.categories.length * 34) }} role="img" aria-label="Issues by category">
                      <ResponsiveContainer initialDimension={{ width: 320, height: 200 }}>
                        <BarChart accessibilityLayer={false} data={stats.categories} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid stroke={chart.grid} horizontal={false} />
                          <XAxis type="number" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" width={96} tick={axisTick} tickLine={false} axisLine={false} />
                          <Tooltip {...tooltipProps} />
                          <Bar dataKey="value" name="Issues" radius={[0, 3, 3, 0]} barSize={16}>
                            {stats.categories.map((_, i) => (
                              <Cell key={i} fill={chart.categorical[i % chart.categorical.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card>
                  <CardHeader title="Locations" description="Issues by campus place" />
                  <div className="mt-3 border-t border-border">
                    <TableWrap label="Issues by campus place">
                      <thead>
                        <tr>
                          <th className={th}>Place</th>
                          <th className={`${th} text-right`}>Total</th>
                          <th className={`${th} text-right`}>Open</th>
                          <th className={`${th} text-right`}>Avg. time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.places.buildings
                          .filter((b) => b.total > 0)
                          .sort((a, b) => b.total - a.total)
                          .map((b) => (
                            <tr key={b.buildingId}>
                              <td className={td}>
                                <span className="block">{b.name}</span>
                                {b.topCategory && <span className="text-xs text-fg-subtle">Mostly {b.topCategory}</span>}
                              </td>
                              <td className={`${td} tabular text-right`}>{b.total}</td>
                              <td className={`${td} tabular text-right`}>{b.open}</td>
                              <td className={`${td} tabular text-right text-fg-muted`}>{formatHours(b.averageResolutionHours) ?? "—"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </TableWrap>
                    {stats.places.unplaced > 0 && <p className="px-4 py-2.5 text-xs text-fg-subtle sm:px-5">{stats.places.unplaced} issue(s) couldn&apos;t be matched to a building.</p>}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Status, priority and deadlines" />
                  <CardBody className="space-y-5">
                    {[
                      { title: "Status", rows: ISSUE_STATUSES.map((s) => ({ label: s, value: stats.status[s], color: statusColors[s] })) },
                      { title: "Priority", rows: PRIORITIES.slice().reverse().map((p) => ({ label: p, value: stats.priority[p], color: priorityColors[p] })) },
                    ].map((group) => (
                      <div key={group.title}>
                        <p className="mb-2 text-xs font-medium text-fg-subtle">{group.title}</p>
                        <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                          {group.rows.map((r) => (
                            <div key={r.label} style={{ width: `${(r.value / Math.max(1, issues.length)) * 100}%`, background: r.color }} />
                          ))}
                        </div>
                        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                          {group.rows.map((r) => (
                            <li key={r.label} className="flex items-center gap-1.5 text-fg-muted">
                              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                              {r.label} <span className="tabular font-medium text-fg">{r.value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    <div>
                      <p className="mb-2 text-xs font-medium text-fg-subtle">Deadlines</p>
                      <dl className="grid grid-cols-3 gap-2 text-[13px] sm:grid-cols-5">
                        {(Object.keys(SLA_LABELS) as (keyof typeof SLA_LABELS)[]).map((s) => (
                          <div key={s} className="rounded-md border border-border px-2 py-1.5">
                            <dt className="truncate text-xs text-fg-subtle">{SLA_LABELS[s]}</dt>
                            <dd className={`tabular font-semibold ${s === "breached" && stats.sla.counts[s] ? "text-danger" : "text-fg"}`}>{stats.sla.counts[s]}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-2 text-xs text-fg-subtle">
                        Targets: High {slaConfig.hours.High}h · Medium {slaConfig.hours.Medium}h · Low {slaConfig.hours.Low}h{slaConfig.isDefault ? " (defaults)" : ""}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </div>

              <Card>
                <CardHeader title="Satisfaction" description="Ratings from reporters for issues in this range — aggregated, without identities" />
                <CardBody>
                  {satisfaction.count === 0 ? (
                    <EmptyState compact title="No ratings yet" description="Reporters can rate an issue once it's resolved." />
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
                      <div>
                        <p className="tabular text-3xl font-semibold tracking-tight text-fg">{satisfaction.average}</p>
                        <p className="text-[13px] text-fg-subtle">
                          out of 5 · {satisfaction.count} rating{satisfaction.count === 1 ? "" : "s"}
                        </p>
                        {satisfaction.lowRated.length > 0 && <p className="mt-2 text-xs text-warning">{satisfaction.lowRated.length} rated 1–2 stars</p>}
                      </div>
                      <ul className="space-y-1.5">
                        {([5, 4, 3, 2, 1] as const).map((r) => {
                          const n = satisfaction.distribution[r];
                          const pct = Math.round((n / satisfaction.count) * 100);
                          return (
                            <li key={r} className="grid grid-cols-[2.5rem_1fr_4.5rem] items-center gap-3 text-[13px]">
                              <span className="text-fg-muted">{r} star</span>
                              <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: chart.primary }} />
                              </span>
                              <span className="tabular text-right text-fg-muted">
                                {n} · {pct}%
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}
        </div>
      )}

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        side="bottom"
        footer={
          <>
            <Button variant="secondary" className="flex-1" onClick={() => setFilters({})}>
              Reset
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              Show {issues.length} issues
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 p-4">
          <FilterFields filters={filters} setFilter={setFilter} workers={workers} />
        </div>
      </Drawer>
    </>
  );
}
