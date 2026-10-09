"use client";

import React, { useState } from "react";
import { CheckCircle2, Download, ListChecks, ShieldCheck, Star, Timer } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Tabs";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState } from "@/components/ui/States";
import { formatHours } from "@/components/admin/Kpi";
import { Donut, Heatmap, HorizontalBars, ShareList, StackedBars, TrendChart } from "@/components/viewer/charts";
import { SectionCard, ViewerGate } from "@/components/viewer/parts";
import { useChartTheme } from "@/hooks/useChartTheme";
import { DEPARTMENTS, ISSUE_CATEGORIES, departmentFor, ISSUE_STATUSES, PRIORITIES } from "@/lib/constants";
import { categoryDistribution, priorityCounts, resolutionByCategory, resolutionStats, slaSummary, statusCounts, timeSeries, workerWorkload } from "@/lib/intelligence/analytics";
import { SLA_LABELS } from "@/lib/intelligence/sla";
import { downloadText, isoOrEmpty, toCsv, toJson } from "@/lib/export";
import { DemoIssue } from "@/lib/viewer/demoData";
import { BUILDINGS, buildingForIssue, getBuilding } from "@/lib/campus";
import { departmentStats, reportingHeatmap, satisfaction, slaCompliance } from "@/lib/viewer/demoStats";

type Range = 7 | 14 | 30;
const DAY = 86_400_000;

export default function ViewerAnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [place, setPlace] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [worker, setWorker] = useState("");
  const chart = useChartTheme();

  return (
    <ViewerGate>
      {({ data, slaConfig, demoToast, workerName, workers, stats }) => {
        const to = data.now;
        const from = new Date(to.getTime() - (range - 1) * DAY);
        const scoped = data.issues.filter(
          (i) =>
            i.createdAt.getTime() >= from.getTime() - 0 &&
            (!category || i.category === category) &&
            (!department || departmentFor(i.category) === department) &&
            (!status || i.status === status) &&
            (!priority || i.priority === priority) &&
            (!worker || i.assignedTo === worker) &&
            (!place || buildingForIssue(i, stats.locationBuildings)?.id === place)
        );
        // Issues resolved in the window count even if reported earlier; reported-in-window drives everything else.
        const statusTotals = statusCounts(scoped);
        const sla = slaSummary(scoped, slaConfig, data.now);
        const res = resolutionStats(scoped);
        const compliance = slaCompliance(sla.counts);
        const trend = timeSeries(scoped, from, to, "day");
        const cats = categoryDistribution(scoped);
        const pri = priorityCounts(scoped);
        const sat = satisfaction(scoped);
        const load = workerWorkload(scoped);
        const heat = reportingHeatmap(scoped);
        const depts = departmentStats(scoped as DemoIssue[], slaConfig, data.now);

        const chips: FilterChip[] = [
          category && { key: "c", label: category, onRemove: () => setCategory("") },
          department && { key: "d", label: department, onRemove: () => setDepartment("") },
          place && { key: "b", label: getBuilding(place)?.name ?? place, onRemove: () => setPlace("") },
          status && { key: "s", label: `Status: ${status}`, onRemove: () => setStatus("") },
          priority && { key: "p", label: `Priority: ${priority}`, onRemove: () => setPriority("") },
          worker && { key: "w", label: workerName(worker), onRemove: () => setWorker("") },
        ].filter(Boolean) as FilterChip[];

        const exportRows = (kind: "csv" | "json") => {
          const columns = [
            { header: "Issue", value: (i: DemoIssue) => i.id },
            { header: "Category", value: (i: DemoIssue) => i.category },
            { header: "Priority", value: (i: DemoIssue) => i.priority },
            { header: "Status", value: (i: DemoIssue) => i.status },
            { header: "Location", value: (i: DemoIssue) => i.location },
            { header: "Reported", value: (i: DemoIssue) => isoOrEmpty(i.createdAt) },
            { header: "Resolved", value: (i: DemoIssue) => isoOrEmpty(i.resolvedAt) },
          ];
          downloadText(`demo-analytics-${range}d.${kind}`, kind === "csv" ? toCsv(scoped, columns) : toJson(scoped, columns), kind === "csv" ? "text/csv" : "application/json");
          demoToast("Demo analytics exported", `${scoped.length} sample issues, no reporter identities. Demo mode — no real data was modified.`);
        };

        return (
          <>
            <PageHeader
              title="Analytics"
              description="Trends, deadlines and performance computed from the demo data. Change the range or filters and every chart follows."
              actions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => exportRows("csv")} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>
                    Export CSV
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => exportRows("json")} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>
                    Export JSON
                  </Button>
                </>
              }
            />

            <Card className="mb-6 p-3 sm:p-4" data-tour="analytics-filters">
              <FilterBar
                chips={chips}
                onClear={() => {
                  setCategory("");
                  setDepartment("");
                  setPlace("");
                  setStatus("");
                  setPriority("");
                  setWorker("");
                }}
                trailing={
                  <Segmented<string>
                    label="Date range"
                    size="sm"
                    value={String(range)}
                    onChange={(v) => setRange(Number(v) as Range)}
                    options={[
                      { value: "7", label: "7 days" },
                      { value: "14", label: "14 days" },
                      { value: "30", label: "30 days" },
                    ]}
                  />
                }
              >
                <Select size="sm" aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value)} wrapperClassName="w-auto">
                  <option value="">All categories</option>
                  {ISSUE_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} wrapperClassName="w-auto">
                  <option value="">All departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Campus place" value={place} onChange={(e) => setPlace(e.target.value)} wrapperClassName="w-auto">
                  <option value="">All places</option>
                  {BUILDINGS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="w-auto">
                  <option value="">Any status</option>
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} wrapperClassName="w-auto">
                  <option value="">Any priority</option>
                  {PRIORITIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Worker" value={worker} onChange={(e) => setWorker(e.target.value)} wrapperClassName="w-auto">
                  <option value="">All workers</option>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </FilterBar>
            </Card>

            {scoped.length === 0 ? (
              <Card>
                <EmptyState title="No demo issues in this view" description="Try a longer range or clear a filter." />
              </Card>
            ) : (
              <div data-tour="analytics-charts">
                <KpiGrid className="mb-6 xl:grid-cols-4">
                  <KpiCard label="Reported" value={scoped.length} icon={<ListChecks />} hint={`Last ${range} days`} spark={trend.map((t) => t.reported)} />
                  <KpiCard label="Resolved" value={statusTotals.Resolved} icon={<CheckCircle2 />} tone="success" hint={`${statusTotals.Open + statusTotals["In Progress"]} still open`} spark={trend.map((t) => t.resolved)} />
                  <KpiCard label="Avg resolution" value={formatHours(res.averageHours) ?? "—"} icon={<Timer />} hint={res.medianHours !== null ? `Median ${formatHours(res.medianHours)}` : "Nothing resolved yet"} />
                  <KpiCard
                    label="SLA compliance"
                    value={compliance}
                    format={(n) => `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })}%`}
                    icon={<ShieldCheck />}
                    tone={compliance !== null && compliance < 80 ? "warning" : "success"}
                    hint={`${sla.counts.met} met · ${sla.counts.missed} missed`}
                  />
                </KpiGrid>

                <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
                  <SectionCard id="volume" title="Issue volume" description="Reported and resolved per day">
                    <TrendChart data={trend} caption={`Issues reported and resolved per day over the last ${range} days`} height={256} />
                  </SectionCard>
                  <SectionCard id="categories" title="Categories" description="Share of reports">
                    <Donut data={cats} caption="Reports by category" centerLabel="reports" />
                  </SectionCard>

                  <SectionCard title="Priority and status" description="How each priority is progressing">
                    <StackedBars
                      caption="Issues by priority and status"
                      data={(["High", "Medium", "Low"] as const).map((p) => ({
                        name: p,
                        Open: scoped.filter((i) => i.priority === p && i.status === "Open").length,
                        "In Progress": scoped.filter((i) => i.priority === p && i.status === "In Progress").length,
                        Resolved: scoped.filter((i) => i.priority === p && i.status === "Resolved").length,
                      }))}
                      series={[
                        { key: "Open", name: "Open", color: chart.primary },
                        { key: "In Progress", name: "In progress", color: chart.warning },
                        { key: "Resolved", name: "Resolved", color: chart.secondary },
                      ]}
                    />
                    <p className="mt-2 text-xs text-fg-subtle">
                      {pri.High} high · {pri.Medium} medium · {pri.Low} low priority
                    </p>
                  </SectionCard>
                  <SectionCard id="sla" title="Deadline performance" description="Where every issue stands against its target">
                    <ShareList
                      label="Deadline states"
                      items={(Object.keys(SLA_LABELS) as (keyof typeof SLA_LABELS)[]).map((s) => ({
                        name: SLA_LABELS[s],
                        value: sla.counts[s],
                        tone: s === "met" ? "success" : s === "breached" || s === "missed" ? "danger" : s === "approaching" ? "warning" : "brand",
                      }))}
                    />
                  </SectionCard>

                  <SectionCard title="Resolution time by category" description="Average hours from report to resolved">
                    <HorizontalBars caption="Average resolution hours by category" valueLabel="Average hours" unit=" h" data={resolutionByCategory(scoped).map((r) => ({ name: r.name, value: r.averageHours }))} />
                  </SectionCard>
                  <SectionCard title="Satisfaction" description={sat.average !== null ? `${sat.average}/5 across ${sat.count} ratings` : "No ratings in this view"}>
                    <ShareList label="Ratings" items={[...sat.distribution].reverse().map((d) => ({ name: `${d.stars} star${d.stars === 1 ? "" : "s"}`, value: d.count, tone: d.stars >= 4 ? "success" : d.stars === 3 ? "warning" : "danger" }))} />
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-subtle">
                      <Star className="h-3.5 w-3.5" aria-hidden="true" />
                      Only the reporter can rate a fix, once.
                    </p>
                  </SectionCard>

                  <SectionCard id="departments" title="Departments" description="Volume and results by responsible team" className="xl:col-span-2" flush>
                    <TableWrap label="Department performance">
                      <thead>
                        <tr>
                          {["Department", "Reports", "Open", "Avg resolution", "SLA compliance"].map((h) => (
                            <th key={h} scope="col" className={th}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {depts.map((d) => (
                          <tr key={d.name} className={trHover}>
                            <th scope="row" className={`${td} text-left font-medium`}>
                              {d.name}
                            </th>
                            <td className={`${td} tabular`}>{d.total}</td>
                            <td className={`${td} tabular`}>{d.open}</td>
                            <td className={`${td} tabular`}>{formatHours(d.averageHours) ?? "—"}</td>
                            <td className={`${td} tabular`}>{d.compliance === null ? "—" : `${d.compliance}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </TableWrap>
                  </SectionCard>

                  <SectionCard id="heatmap" title="When problems are reported" description="Reports by weekday and time of day">
                    <Heatmap {...heat} caption="Reports by weekday and time of day" />
                  </SectionCard>
                  <SectionCard id="workload" title="Worker workload" description="Active and resolved tasks per worker">
                    <StackedBars
                      caption="Active and resolved tasks per worker"
                      height={260}
                      data={load.map((l) => ({ name: workerName(l.workerId).split(" ")[0], Active: l.active, Resolved: l.resolved }))}
                      series={[
                        { key: "Active", name: "Active", color: chart.warning },
                        { key: "Resolved", name: "Resolved", color: chart.secondary },
                      ]}
                    />
                  </SectionCard>
                </div>
              </div>
            )}
          </>
        );
      }}
    </ViewerGate>
  );
}
