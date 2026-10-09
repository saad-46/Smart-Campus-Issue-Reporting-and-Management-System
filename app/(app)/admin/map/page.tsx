"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Search as SearchIcon, X } from "lucide-react";
import { IssueStatus, IssueSummary, Priority } from "@/types";
import { fetchIssueSummaries } from "@/lib/firestore";
import { ISSUE_CATEGORIES, ISSUE_STATUSES, PRIORITIES } from "@/lib/constants";
import { BUILDINGS, VERIFICATION_LABELS, buildingForIssue, getBuilding } from "@/lib/campus";
import { applyFilters, categoryDistribution, hotspots, resolutionStats, slaSummary } from "@/lib/intelligence/analytics";
import { formatRelative } from "@/lib/dates";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useCampusLocations } from "@/hooks/useCampusLocations";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { useNow } from "@/hooks/useNow";
import CampusMap from "@/components/admin/CampusMap";
import { formatHours } from "@/components/admin/Kpi";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import { IconButton, buttonClasses } from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Tabs";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

const DAY = 86_400_000;
const RANGES = [7, 30, 90] as const;

function BuildingPanel({
  buildingId,
  issues,
  onClose,
  showClose,
}: {
  buildingId: string;
  issues: IssueSummary[];
  onClose: () => void;
  showClose: boolean;
}) {
  const slaConfig = useSlaConfig();
  const now = useNow();
  const building = getBuilding(buildingId);
  const open = issues.filter((i) => i.status !== "Resolved");
  const sla = slaSummary(open, slaConfig, now);
  const top = categoryDistribution(issues)[0];
  const resolution = resolutionStats(issues);
  const list = [...issues].sort((a, b) => Number(a.status === "Resolved") - Number(b.status === "Resolved") || b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-fg-subtle">Campus place · {building ? VERIFICATION_LABELS[building.verificationStatus] : ""}</p>
          <h2 className="text-base font-semibold text-fg">{building?.name}</h2>
        </div>
        {showClose && (
          <IconButton label="Close place details" size="sm" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Open issues", value: open.length },
          { label: "Deadline risks", value: sla.counts.breached + sla.counts.approaching, danger: sla.counts.breached > 0 },
          { label: "Resolved", value: issues.length - open.length },
          { label: "Avg. resolution", value: formatHours(resolution.averageHours) ?? "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-md border border-border px-3 py-2">
            <dt className="text-xs text-fg-subtle">{s.label}</dt>
            <dd className={`tabular mt-0.5 text-lg font-semibold ${s.danger ? "text-danger" : "text-fg"}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
      {top && (
        <p className="mt-3 text-[13px] text-fg-muted">
          Most common: <span className="font-medium text-fg">{top.name}</span> ({top.value})
        </p>
      )}
      {issues.length === 0 ? (
        <p className="mt-4 text-[13px] text-fg-subtle">No matching issues at this place for this period.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {list.slice(0, 6).map((i) => (
            <li key={i.id} className="py-2.5">
              <Link href={`/issues/${i.id}`} className="block truncate text-sm text-fg hover:text-brand-fg hover:underline">
                {i.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={i.status} />
                <PriorityBadge priority={i.priority} />
                <span className="text-xs text-fg-subtle">{formatRelative(i.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/admin/issues?building=${buildingId}`} className={buttonClasses("secondary", "md", "mt-4 w-full")}>
        View issues in {building?.short ?? "building"}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

export default function AdminMapPage() {
  const { buildingMap } = useCampusLocations();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [metric, setMetric] = useState<"open" | "total">("open");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<IssueStatus | "">("");
  const [priority, setPriority] = useState<Priority | "">("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<{ issues: IssueSummary[]; capped: boolean } | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetchIssueSummaries({ since: new Date(Date.now() - days * DAY) })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        logError("fetchIssueSummaries", err);
        if (!cancelled) setError(getFriendlyErrorMessage(err, "Map data couldn't be loaded."));
      });
    return () => {
      cancelled = true;
    };
  }, [days, retryKey]);

  const issues = useMemo(
    () => applyFilters(data?.issues ?? [], { category: category || undefined, status: status || undefined, priority: priority || undefined }, buildingMap),
    [data, category, status, priority, buildingMap]
  );
  const places = useMemo(() => hotspots(issues, buildingMap), [issues, buildingMap]);
  const highlight = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return undefined;
    return new Set(BUILDINGS.filter((b) => b.name.toLowerCase().includes(q) || b.short.toLowerCase().includes(q)).map((b) => b.id));
  }, [query]);
  const inBuilding = useMemo(() => (selected ? issues.filter((i) => buildingForIssue(i, buildingMap)?.id === selected) : []), [issues, selected, buildingMap]);
  const ranked = [...places.buildings].filter((b) => !highlight || highlight.has(b.buildingId)).sort((a, b) => (metric === "open" ? b.open - a.open : b.total - a.total));

  return (
    <>
      <PageHeader
        title="Campus map"
        description="Where issues are concentrated. Issues are placed by their QR location or by matching the typed location to a researched SUES campus place. Positions are approximate."
        actions={
          <>
            <Select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value) as (typeof RANGES)[number])} wrapperClassName="w-36">
              {RANGES.map((d) => (
                <option key={d} value={d}>
                  Last {d} days
                </option>
              ))}
            </Select>
            <Segmented
              label="Shade by"
              value={metric}
              onChange={setMetric}
              options={[
                { value: "open", label: "Open" },
                { value: "total", label: "All" },
              ]}
            />
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Input type="search" aria-label="Find a campus place" placeholder="Find a campus place" icon={<SearchIcon aria-hidden="true" />} value={query} onChange={(e) => setQuery(e.target.value)} wrapperClassName="lg:max-w-xs" />
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <Select size="sm" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} wrapperClassName="w-auto shrink-0">
            <option value="">All categories</option>
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <Select size="sm" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as IssueStatus | "")} wrapperClassName="w-auto shrink-0">
            <option value="">All statuses</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select size="sm" aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} wrapperClassName="w-auto shrink-0">
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </div>
      </div>

      {error ? (
        <Card>
          <ErrorState title="Couldn't load the map" description={error} onRetry={() => setRetryKey((k) => k + 1)} />
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardBody>
              {data === null ? (
                <Skeleton className="aspect-[100/64] w-full" />
              ) : (
                <CampusMap hotspots={places.buildings} unplaced={places.unplaced} metric={metric} selectedId={selected} onSelect={setSelected} highlight={highlight} />
              )}
              {data?.capped && <p className="mt-2 text-xs text-fg-subtle">Showing the newest {data.issues.length} issues of this period (query limit reached).</p>}
            </CardBody>
          </Card>

          <Card className="lg:sticky lg:top-20">
            {selected && isDesktop ? (
              <CardBody>
                <BuildingPanel buildingId={selected} issues={inBuilding} onClose={() => setSelected(null)} showClose />
              </CardBody>
            ) : (
              <>
                <CardHeader title="Campus places" description="Select a place for details" />
                <div className="mt-3 border-t border-border">
                  {data === null ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : ranked.length === 0 ? (
                    <EmptyState compact icon={<Building2 />} title="No places match" />
                  ) : (
                    <ul className="max-h-[28rem] overflow-y-auto py-1">
                      {ranked.map((b) => {
                        const value = metric === "open" ? b.open : b.total;
                        return (
                          <li key={b.buildingId}>
                            <button
                              type="button"
                              onClick={() => setSelected(b.buildingId)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-hover"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-fg">{b.name}</span>
                                {b.topCategory && <span className="block text-xs text-fg-subtle">Mostly {b.topCategory}</span>}
                              </span>
                              <span className={`tabular shrink-0 ${value ? "font-medium text-fg" : "text-fg-subtle"}`}>{value}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      <Drawer open={!!selected && !isDesktop} onClose={() => setSelected(null)} title={getBuilding(selected)?.name ?? "Building"} side="bottom">
        <div className="p-4">{selected && <BuildingPanel buildingId={selected} issues={inBuilding} onClose={() => setSelected(null)} showClose={false} />}</div>
      </Drawer>
    </>
  );
}
