"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, FilePlus2 } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button, { buttonClasses } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { IssueTable, ViewerGate, ViewerLoading } from "@/components/viewer/parts";
import { ISSUE_CATEGORIES, ISSUE_STATUSES, PRIORITIES } from "@/lib/constants";
import { computeSla, SLA_LABELS } from "@/lib/intelligence/sla";
import { searchIssues } from "@/lib/search";
import { toCsv, toJson, downloadText, isoOrEmpty } from "@/lib/export";
import { DEMO_STUDENTS, DEMO_WORKERS, DemoIssue, workerName } from "@/lib/viewer/demoData";
import { SlaState } from "@/types";

interface Filters {
  q: string;
  status: string;
  priority: string;
  category: string;
  sla: string;
  worker: string;
}
const NONE: Filters = { q: "", status: "", priority: "", category: "", sla: "", worker: "" };

function IssuesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const reporter = params.get("reporter") ?? "";
  const [f, setF] = useState<Filters>(NONE);
  const set = (patch: Partial<Filters>) => setF((p) => ({ ...p, ...patch }));

  return (
    <ViewerGate>
      {({ data, slaConfig, role, demoToast }) => {
        const student = reporter ? DEMO_STUDENTS.find((s) => s.id === reporter) : undefined;
        const filtered = filterIssues(data.issues, f, reporter, slaConfig, data.now);
        const chips: FilterChip[] = [
          f.status && { key: "status", label: `Status: ${f.status}`, onRemove: () => set({ status: "" }) },
          f.priority && { key: "priority", label: `Priority: ${f.priority}`, onRemove: () => set({ priority: "" }) },
          f.category && { key: "category", label: f.category, onRemove: () => set({ category: "" }) },
          f.sla && { key: "sla", label: `Deadline: ${SLA_LABELS[f.sla as SlaState]}`, onRemove: () => set({ sla: "" }) },
          f.worker && { key: "worker", label: f.worker === "none" ? "Unassigned" : workerName(f.worker), onRemove: () => set({ worker: "" }) },
          student && { key: "reporter", label: `Reported by ${student.name}`, onRemove: () => router.replace("/viewer/issues") },
        ].filter(Boolean) as FilterChip[];

        const clear = () => {
          setF(NONE);
          if (reporter) router.replace("/viewer/issues");
        };

        const exportRows = (kind: "csv" | "json") => {
          const columns = [
            { header: "Issue", value: (i: DemoIssue) => i.id },
            { header: "Title", value: (i: DemoIssue) => i.title },
            { header: "Category", value: (i: DemoIssue) => i.category },
            { header: "Priority", value: (i: DemoIssue) => i.priority },
            { header: "Status", value: (i: DemoIssue) => i.status },
            { header: "Location", value: (i: DemoIssue) => i.location },
            { header: "Reported", value: (i: DemoIssue) => isoOrEmpty(i.createdAt) },
            { header: "Resolved", value: (i: DemoIssue) => isoOrEmpty(i.resolvedAt) },
          ];
          downloadText(kind === "csv" ? "demo-issues.csv" : "demo-issues.json", kind === "csv" ? toCsv(filtered, columns) : toJson(filtered, columns), kind === "csv" ? "text/csv" : "application/json");
          demoToast("Demo report exported", `${filtered.length} sample issues, no reporter identities. Demo mode — no real data was modified.`);
        };

        return (
          <>
            <PageHeader
              title={role === "student" ? "Community issues" : role === "worker" ? "All issues" : "Issues"}
              description={role === "student" ? "Everything reported on campus. If you see your problem here, upvote it instead of reporting it again." : "Search, filter and sort every report in the demo."}
              actions={
                role !== "admin" ? (
                  <Link href="/viewer/report" className={buttonClasses("primary")}>
                    <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                    Report an issue
                  </Link>
                ) : undefined
              }
            />
            <Card className="mb-4 p-3 sm:p-4">
              <FilterBar
                search={f.q}
                onSearch={(q) => set({ q })}
                searchLabel="Search issues"
                placeholder="Search by title, place, category or number"
                chips={chips}
                onClear={clear}
                tour="issues-filters"
                trailing={
                  role === "admin" ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => exportRows("csv")} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>
                        CSV
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => exportRows("json")} icon={<Download className="h-3.5 w-3.5" aria-hidden="true" />}>
                        JSON
                      </Button>
                    </>
                  ) : undefined
                }
              >
                <Select size="sm" aria-label="Status" value={f.status} onChange={(e) => set({ status: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Any status</option>
                  {ISSUE_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Priority" value={f.priority} onChange={(e) => set({ priority: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Any priority</option>
                  {PRIORITIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Category" value={f.category} onChange={(e) => set({ category: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Any category</option>
                  {ISSUE_CATEGORIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Deadline state" value={f.sla} onChange={(e) => set({ sla: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Any deadline state</option>
                  {(Object.keys(SLA_LABELS) as SlaState[]).map((s) => (
                    <option key={s} value={s}>
                      {SLA_LABELS[s]}
                    </option>
                  ))}
                </Select>
                <Select size="sm" aria-label="Assigned to" value={f.worker} onChange={(e) => set({ worker: e.target.value })} wrapperClassName="w-auto">
                  <option value="">Anyone</option>
                  <option value="none">Unassigned</option>
                  {DEMO_WORKERS.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </Select>
              </FilterBar>
            </Card>
            <Card className="overflow-hidden">
              <IssueTable issues={filtered} now={data.now} config={slaConfig} label="Issues" tour="issues-table" emptyAction={chips.length || f.q ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : undefined} />
            </Card>
          </>
        );
      }}
    </ViewerGate>
  );
}

/** Filtering as a plain function (hooks must not run inside the data gate's render callback). */
function filterIssues(issues: DemoIssue[], f: Filters, reporter: string, config: Parameters<typeof computeSla>[1], now: Date): DemoIssue[] {
  const base = f.q.trim() ? searchIssues(issues, f.q, {}, 500).map((h) => h.issue as DemoIssue) : [...issues].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return base.filter(
    (i) =>
      (!f.status || i.status === f.status) &&
      (!f.priority || i.priority === f.priority) &&
      (!f.category || i.category === f.category) &&
      (!reporter || i.reporterId === reporter) &&
      (!f.worker || (f.worker === "none" ? !i.assignedTo : i.assignedTo === f.worker)) &&
      (!f.sla || computeSla(i, config, now).state === f.sla)
  );
}

export default function ViewerIssuesPage() {
  return (
    <Suspense fallback={<ViewerLoading />}>
      <IssuesInner />
    </Suspense>
  );
}
