"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Building2, FilePlus2, Layers, MapPin } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { VERIFICATION_TONE } from "@/components/viewer/verification";
import { buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { DescriptionList } from "@/components/ui/Data";
import { EmptyState, Notice } from "@/components/ui/States";
import CampusMap, { DEFAULT_LAYERS, MapLayers } from "@/components/admin/CampusMap";
import { formatHours } from "@/components/admin/Kpi";
import { SectionCard, ViewerGate } from "@/components/viewer/parts";
import {
  BUILDINGS,
  CAMPUS,
  CAMPUS_LOCATIONS,
  INSTITUTIONS,
  PLACE_TYPE_LABELS,
  PlaceType,
  VERIFICATION_LABELS,
  VerificationStatus,
  buildingForIssue,
  getBuilding,
  institutionName,
} from "@/lib/campus";
import { computeSla } from "@/lib/intelligence/sla";
import { hotspots as computeHotspots } from "@/lib/intelligence/analytics";
import { ISSUE_CATEGORIES, ISSUE_STATUSES, PRIORITIES } from "@/lib/constants";
import { LOCATION_BUILDINGS } from "@/lib/viewer/demoStats";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/cn";

type Layer = "density" | "all" | "incidents" | "risk" | "sla";

const LAYERS: { id: Layer; label: string; help: string; unit: string }[] = [
  { id: "density", label: "Issue density", help: "Open sample issues per place.", unit: "open issue" },
  { id: "all", label: "All reports", help: "Every sample report in the range, resolved or not.", unit: "report" },
  { id: "incidents", label: "Active incidents", help: "Reports linked into an unresolved incident.", unit: "incident report" },
  { id: "risk", label: "Maintenance risk", help: "An estimate (0–100) from how often and how recently faults recur. Not a prediction.", unit: "risk point" },
  { id: "sla", label: "SLA hotspots", help: "Open issues that are due soon or overdue.", unit: "deadline alert" },
];

const BASE: { key: keyof MapLayers; label: string }[] = [
  { key: "places", label: "Campus places" },
  { key: "footprints", label: "Building footprints" },
  { key: "roads", label: "Roads and paths" },
  { key: "gates", label: "Mapped gates" },
  { key: "surroundings", label: "Surrounding buildings" },
];


const DAY = 86_400_000;

export default function ViewerMapPage() {
  const [layer, setLayer] = useState<Layer>("density");
  const [base, setBase] = useState<MapLayers>(DEFAULT_LAYERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ category: "", status: "", priority: "", institution: "", type: "", verification: "", days: "30" });
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  return (
    <ViewerGate>
      {({ data, stats, slaConfig }) => {
        const since = data.now.getTime() - Number(f.days) * DAY;
        const issues = data.issues.filter(
          (i) => i.createdAt.getTime() >= since && (!f.category || i.category === f.category) && (!f.status || i.status === f.status) && (!f.priority || i.priority === f.priority)
        );
        const spots = computeHotspots(issues, LOCATION_BUILDINGS);
        const values = new Map<string, number>();
        const add = (id: string | undefined, n = 1) => id && values.set(id, (values.get(id) ?? 0) + n);
        const placeOf = (i: (typeof issues)[number]) => buildingForIssue(i, LOCATION_BUILDINGS)?.id;

        if (layer === "incidents") {
          const active = new Set(stats.incidents.filter((c) => c.status !== "Resolved").flatMap((c) => [c.masterIssueId, ...c.relatedIssueIds]));
          for (const i of issues) if (active.has(i.id)) add(placeOf(i));
        } else if (layer === "risk") {
          if (stats.risk.sufficient) for (const r of stats.risk.indicators) if (r.buildingId) values.set(r.buildingId, Math.max(values.get(r.buildingId) ?? 0, Math.round(r.score * 100)));
        } else if (layer === "sla") {
          for (const i of issues) if (i.status !== "Resolved" && computeSla(i, slaConfig, data.now).state !== "on-track") add(placeOf(i));
        }
        const custom = layer === "incidents" || layer === "risk" || layer === "sla";
        const current = LAYERS.find((l) => l.id === layer)!;

        // Search and place filters decide which markers stay emphasised.
        const query = q.trim().toLowerCase();
        const matching = BUILDINGS.filter((b) => {
          if (f.institution && b.institutionId !== f.institution) return false;
          if (f.type && b.type !== f.type) return false;
          if (f.verification && b.verificationStatus !== f.verification) return false;
          if (!query) return true;
          const names = [b.name, b.short, institutionName(b.institutionId) ?? "", ...CAMPUS_LOCATIONS.filter((l) => l.placeId === b.id).flatMap((l) => [l.name, ...l.aliases])];
          const issueHit = issues.some((i) => placeOf(i) === b.id && (i.id.toLowerCase() === query || i.title.toLowerCase().includes(query)));
          return issueHit || names.some((n) => n.toLowerCase().includes(query));
        });
        const filtering = !!(query || f.institution || f.type || f.verification);
        const highlight = filtering ? new Set(matching.map((b) => b.id)) : undefined;
        const unplacedMatch = query ? CAMPUS_LOCATIONS.filter((l) => !l.placeId && [l.name, ...l.aliases].some((n) => n.toLowerCase().includes(query))) : [];

        const chips: FilterChip[] = [
          f.category && { key: "c", label: f.category, onRemove: () => set({ category: "" }) },
          f.status && { key: "s", label: `Status: ${f.status}`, onRemove: () => set({ status: "" }) },
          f.priority && { key: "p", label: `Priority: ${f.priority}`, onRemove: () => set({ priority: "" }) },
          f.institution && { key: "i", label: institutionName(f.institution, true) ?? f.institution, onRemove: () => set({ institution: "" }) },
          f.type && { key: "t", label: PLACE_TYPE_LABELS[f.type as PlaceType], onRemove: () => set({ type: "" }) },
          f.verification && { key: "v", label: VERIFICATION_LABELS[f.verification as VerificationStatus], onRemove: () => set({ verification: "" }) },
          f.days !== "30" && { key: "d", label: `Last ${f.days} days`, onRemove: () => set({ days: "30" }) },
        ].filter(Boolean) as FilterChip[];

        const place = getBuilding(selected);
        const spot = selected ? spots.buildings.find((b) => b.buildingId === selected) : undefined;
        const here = issues.filter((i) => placeOf(i) === selected).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const openHere = here.filter((i) => i.status !== "Resolved");
        const risks = stats.risk.sufficient ? stats.risk.indicators.filter((r) => r.buildingId === selected) : [];
        const locationsHere = CAMPUS_LOCATIONS.filter((l) => l.placeId === selected && l.isActive);

        return (
          <>
            <PageHeader
              title="Campus map"
              description={`SUES campus: ${CAMPUS.address.replace(/"/g, "")}, ${CAMPUS.city}. Real map geometry with sample issues on top.`}
            />
            <Notice tone="info" className="mb-4">
              The buildings, roads and gates are real map data. The issue counts are sample data for the demo; none of these issues happened. Place positions come from official
              geotagged photographs and are approximate.
            </Notice>

            <Card className="mb-4 p-3 sm:p-4">
              <FilterBar
                search={q}
                onSearch={setQ}
                searchLabel="Search the map"
                placeholder="Search a block, hall, institution or issue"
                chips={chips}
                onClear={() => setF({ category: "", status: "", priority: "", institution: "", type: "", verification: "", days: "30" })}
              >
                <Select size="sm" aria-label="Date range" value={f.days} onChange={(e) => set({ days: e.target.value })} wrapperClassName="w-auto">
                  <option value="7">Last 7 days</option>
                  <option value="14">Last 14 days</option>
                  <option value="30">Last 30 days</option>
                </Select>
                <Select size="sm" aria-label="Category" value={f.category} onChange={(e) => set({ category: e.target.value })} wrapperClassName="w-auto">
                  <option value="">All categories</option>
                  {ISSUE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Any status</option>
                  {ISSUE_STATUSES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Priority" value={f.priority} onChange={(e) => set({ priority: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Any priority</option>
                  {PRIORITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Institution" value={f.institution} onChange={(e) => set({ institution: e.target.value })} wrapperClassName="w-auto">
                  <option value="">All institutions</option>
                  {INSTITUTIONS.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.shortName}
                    </option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Place type" value={f.type} onChange={(e) => set({ type: e.target.value })} wrapperClassName="w-auto">
                  <option value="">All place types</option>
                  {[...new Set(BUILDINGS.map((b) => b.type))].map((t) => (
                    <option key={t} value={t}>
                      {PLACE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Verification" value={f.verification} onChange={(e) => set({ verification: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Any verification</option>
                  {[...new Set(BUILDINGS.map((b) => b.verificationStatus))].map((t) => (
                    <option key={t} value={t}>
                      {VERIFICATION_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </FilterBar>
              {filtering && (
                <p className="mt-2 text-[13px] text-fg-subtle" aria-live="polite">
                  {matching.length === 0
                    ? "No mapped place matches. Only researched campus places are searched, not street addresses."
                    : `${matching.length} place${matching.length === 1 ? "" : "s"} highlighted.`}
                  {unplacedMatch.length > 0 && ` ${unplacedMatch.map((l) => l.name).join(", ")}: on campus, but its position isn't known, so it has no marker.`}
                </p>
              )}
            </Card>

            <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
              <Card className="min-w-0 p-4 sm:p-5" data-tour="map-canvas">
                <CampusMap
                  hotspots={spots.buildings}
                  unplaced={spots.unplaced}
                  selectedId={selected}
                  onSelect={setSelected}
                  metric={layer === "all" ? "total" : "open"}
                  values={custom ? values : undefined}
                  valueLabel={custom ? current.unit : undefined}
                  highlight={highlight}
                  layers={base}
                />
              </Card>

              <div className="min-w-0 space-y-6">
                <Card className="p-4" data-tour="map-layers">
                  <fieldset>
                    <legend className="flex items-center gap-2 text-sm font-semibold text-fg">
                      <Layers className="h-4 w-4 text-brand-fg" aria-hidden="true" />
                      Issue layer
                    </legend>
                    <div className="mt-3 space-y-1.5">
                      {LAYERS.map((l) => (
                        <label key={l.id} className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors", layer === l.id ? "border-brand bg-brand-subtle" : "border-transparent hover:bg-surface-hover")}>
                          <input type="radio" name="layer" value={l.id} checked={layer === l.id} onChange={() => setLayer(l.id)} className="mt-1 accent-[var(--brand)]" />
                          <span>
                            <span className="block text-sm font-medium text-fg">{l.label}</span>
                            <span className="block text-xs text-fg-subtle">{l.help}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {layer === "risk" && !stats.risk.sufficient && <p className="mt-3 text-[13px] text-fg-subtle">{stats.risk.reason}</p>}
                  <fieldset className="mt-4 border-t border-border pt-3">
                    <legend className="sr-only">Map features</legend>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-fg-subtle" aria-hidden="true">
                      Map features
                    </p>
                    <div className="grid gap-1.5">
                      {BASE.map((b) => (
                        <label key={b.key} className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                          <input type="checkbox" checked={base[b.key]} onChange={(e) => setBase((p) => ({ ...p, [b.key]: e.target.checked }))} className="accent-[var(--brand)]" />
                          {b.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </Card>

                <SectionCard title={place ? place.name : "Place detail"} description={place ? PLACE_TYPE_LABELS[place.type] : "Nothing selected"}>
                  {!place || !spot ? (
                    <EmptyState compact icon={<Building2 />} title="Select a place" description="Click or press Enter on a marker to see what is known about it and its sample issues." />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={VERIFICATION_TONE[place.verificationStatus]}>{VERIFICATION_LABELS[place.verificationStatus]}</Badge>
                        {institutionName(place.institutionId, true) && <Badge>{institutionName(place.institutionId, true)}</Badge>}
                      </div>
                      <p className="text-[13px] leading-relaxed text-fg-muted">{place.notes}</p>
                      <DescriptionList
                        columns={2}
                        items={[
                          { label: "Open (sample)", value: spot.open },
                          { label: "Resolved (sample)", value: spot.resolved },
                          { label: "Most common", value: spot.topCategory ?? "—" },
                          { label: "Avg resolution", value: formatHours(spot.averageResolutionHours) ?? "—" },
                          { label: "Position", value: <span className="tabular text-[13px]">{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</span> },
                          { label: "Within about", value: `${place.precisionMeters} m` },
                        ]}
                      />
                      {locationsHere.length > 0 && (
                        <div>
                          <h3 className="mb-1.5 text-[13px] font-semibold text-fg">Report an issue here</h3>
                          <ul className="flex flex-wrap gap-1.5">
                            {locationsHere.map((l) => (
                              <li key={l.id}>
                                <Link href={`/viewer/report?location=${l.id}`} className={buttonClasses("secondary", "sm")}>
                                  <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  {l.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {risks.map((r) => (
                        <p key={r.key} className="rounded-lg border border-warning-border bg-warning-subtle p-2.5 text-[13px] text-fg">
                          <Badge tone={r.level === "High" ? "danger" : r.level === "Medium" ? "warning" : "neutral"}>{r.level} risk (estimate)</Badge>{" "}
                          {r.label}: {r.repeatedCategory ? `${r.repeatedCount} repeated ${r.repeatedCategory} faults` : `${r.issuesInWindow} reports in 90 days`}.
                        </p>
                      ))}
                      <div>
                        <h3 className="mb-1.5 text-[13px] font-semibold text-fg">Open sample issues</h3>
                        {openHere.length === 0 ? (
                          <p className="text-[13px] text-fg-subtle">{here.length === 0 ? "No sample issues at this place for these filters." : "Nothing open here."}</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {openHere.slice(0, 5).map((i) => (
                              <li key={i.id} className="py-2">
                                <Link href={`/viewer/issues/${i.id}`} className="text-sm font-medium text-fg hover:text-brand-fg">
                                  {i.title}
                                </Link>
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
                                  <StatusBadge status={i.status} />
                                  <PriorityBadge priority={i.priority} />
                                  {formatRelative(i.createdAt, data.now)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {openHere.length > 5 && <p className="mt-1 text-xs text-fg-subtle">and {openHere.length - 5} more</p>}
                      </div>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=19/${place.latitude}/${place.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-fg hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        Open this position in OpenStreetMap
                      </a>
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">
              {BUILDINGS.length} mapped places and {CAMPUS_LOCATIONS.filter((l) => !l.placeId).length} campus locations without a known position. No campus boundary is drawn because none could be
              verified; the dashed outline is the college area as mapped in OpenStreetMap, which is incomplete.
            </p>
          </>
        );
      }}
    </ViewerGate>
  );
}
