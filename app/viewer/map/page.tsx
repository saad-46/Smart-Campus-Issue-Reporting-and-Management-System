"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Building2, Layers } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import { DescriptionList } from "@/components/ui/Data";
import { EmptyState } from "@/components/ui/States";
import CampusMap from "@/components/admin/CampusMap";
import { formatHours } from "@/components/admin/Kpi";
import { SectionCard, ViewerGate } from "@/components/viewer/parts";
import { BUILDINGS, getBuilding, matchBuilding } from "@/lib/campus";
import { computeSla } from "@/lib/intelligence/sla";
import { hotspots as computeHotspots } from "@/lib/intelligence/analytics";
import { ISSUE_CATEGORIES } from "@/lib/constants";
import { LOCATION_BUILDINGS } from "@/lib/viewer/demoStats";
import { cn } from "@/lib/cn";

type Layer = "density" | "all" | "incidents" | "risk" | "sla";

const LAYERS: { id: Layer; label: string; help: string; unit: string }[] = [
  { id: "density", label: "Issue density", help: "Open issues per building.", unit: "open issue" },
  { id: "all", label: "All reports", help: "Every report in the window, resolved or not.", unit: "report" },
  { id: "incidents", label: "Active incidents", help: "Reports linked into an unresolved incident.", unit: "incident report" },
  { id: "risk", label: "Maintenance risk", help: "Risk score (0–100) from how often and how recently faults recur.", unit: "risk point" },
  { id: "sla", label: "SLA hotspots", help: "Open issues that are due soon or overdue.", unit: "deadline alert" },
];

export default function ViewerMapPage() {
  const [layer, setLayer] = useState<Layer>("density");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ViewerGate>
      {({ data, stats, slaConfig }) => {
        const issues = data.issues.filter((i) => !category || i.category === category);
        const spots = computeHotspots(issues, LOCATION_BUILDINGS);
        const values = new Map<string, number>();
        const add = (id: string | undefined, n = 1) => id && values.set(id, (values.get(id) ?? 0) + n);

        if (layer === "incidents") {
          const active = new Set(stats.incidents.filter((c) => c.status !== "Resolved").flatMap((c) => [c.masterIssueId, ...c.relatedIssueIds]));
          for (const i of issues) if (active.has(i.id)) add(matchBuilding(i.location)?.id);
        } else if (layer === "risk") {
          if (stats.risk.sufficient) for (const r of stats.risk.indicators) if (r.buildingId) values.set(r.buildingId, Math.max(values.get(r.buildingId) ?? 0, Math.round(r.score * 100)));
        } else if (layer === "sla") {
          for (const i of issues) if (i.status !== "Resolved" && computeSla(i, slaConfig, data.now).state !== "on-track") add(matchBuilding(i.location)?.id);
        }
        const custom = layer === "incidents" || layer === "risk" || layer === "sla";
        const current = LAYERS.find((l) => l.id === layer)!;

        const building = selected ? getBuilding(selected) : undefined;
        const spot = selected ? spots.buildings.find((b) => b.buildingId === selected) : undefined;
        const inBuilding = issues.filter((i) => matchBuilding(i.location)?.id === selected).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const openHere = inBuilding.filter((i) => i.status !== "Resolved");
        const risks = stats.risk.sufficient ? stats.risk.indicators.filter((r) => r.buildingId === selected) : [];

        return (
          <>
            <PageHeader title="Campus map" description="A schematic of the campus, shaded by the layer you choose. Select a building for its detail." />
            <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
              <Card className="p-4 sm:p-5">
                <CampusMap
                  hotspots={spots.buildings}
                  unplaced={spots.unplaced}
                  selectedId={selected}
                  onSelect={setSelected}
                  metric={layer === "all" ? "total" : "open"}
                  values={custom ? values : undefined}
                  valueLabel={custom ? current.unit : undefined}
                />
              </Card>

              <div className="space-y-6">
                <Card className="p-4" data-tour="map-layers">
                  <fieldset>
                    <legend className="flex items-center gap-2 text-sm font-semibold text-fg">
                      <Layers className="h-4 w-4 text-brand-fg" aria-hidden="true" />
                      Map layers
                    </legend>
                    <div className="mt-3 space-y-1.5">
                      {LAYERS.map((l) => (
                        <label
                          key={l.id}
                          className={cn("flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors", layer === l.id ? "border-brand bg-brand-subtle" : "border-transparent hover:bg-surface-hover")}
                        >
                          <input type="radio" name="layer" value={l.id} checked={layer === l.id} onChange={() => setLayer(l.id)} className="mt-1 accent-[var(--brand)]" />
                          <span>
                            <span className="block text-sm font-medium text-fg">{l.label}</span>
                            <span className="block text-xs text-fg-subtle">{l.help}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <Select className="mt-3" label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">All categories</option>
                    {ISSUE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </Select>
                  {layer === "risk" && !stats.risk.sufficient && <p className="mt-3 text-[13px] text-fg-subtle">{stats.risk.reason}</p>}
                </Card>

                <SectionCard title={building ? building.name : "Building detail"} description={building ? undefined : "Nothing selected"}>
                  {!building || !spot ? (
                    <EmptyState compact icon={<Building2 />} title="Select a building" description="Click or press Enter on a building to see its issues, incidents and risk." />
                  ) : (
                    <div className="space-y-4">
                      <DescriptionList
                        columns={2}
                        items={[
                          { label: "Open", value: spot.open },
                          { label: "Resolved", value: spot.resolved },
                          { label: "Most common", value: spot.topCategory ?? "—" },
                          { label: "Avg resolution", value: formatHours(spot.averageResolutionHours) ?? "—" },
                        ]}
                      />
                      {risks.map((r) => (
                        <p key={r.key} className="rounded-lg border border-warning-border bg-warning-subtle p-2.5 text-[13px] text-fg">
                          <Badge tone={r.level === "High" ? "danger" : r.level === "Medium" ? "warning" : "neutral"}>{r.level} risk</Badge>{" "}
                          {r.label}: {r.repeatedCategory ? `${r.repeatedCount} repeated ${r.repeatedCategory} faults` : `${r.issuesInWindow} reports in 90 days`}.
                        </p>
                      ))}
                      <div>
                        <h3 className="mb-1.5 text-[13px] font-semibold text-fg">Open issues here</h3>
                        {openHere.length === 0 ? (
                          <p className="text-[13px] text-fg-subtle">No open issues in this building.</p>
                        ) : (
                          <ul className="divide-y divide-border">
                            {openHere.slice(0, 5).map((i) => (
                              <li key={i.id} className="py-2">
                                <Link href={`/viewer/issues/${i.id}`} className="text-sm font-medium text-fg hover:text-brand-fg">
                                  {i.title}
                                </Link>
                                <span className="mt-1 flex flex-wrap gap-1.5">
                                  <StatusBadge status={i.status} />
                                  <PriorityBadge priority={i.priority} />
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {openHere.length > 5 && <p className="mt-1 text-xs text-fg-subtle">and {openHere.length - 5} more</p>}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">
              {BUILDINGS.length} buildings, schematic layout (not GPS). Maintenance risk needs at least 14 days of history and 10 reports, as in the live product.
            </p>
          </>
        );
      }}
    </ViewerGate>
  );
}
