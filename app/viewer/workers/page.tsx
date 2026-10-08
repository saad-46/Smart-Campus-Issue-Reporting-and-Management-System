"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Star } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Drawer from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Field";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { DescriptionList, TableWrap, td, th, trHover } from "@/components/ui/Data";
import { EmptyState } from "@/components/ui/States";
import { currency, formatHours } from "@/components/admin/Kpi";
import { SectionCard, ViewerGate, ViewerLoading } from "@/components/viewer/parts";
import { Avatar } from "@/components/viewer/DemoImage";
import { StatusBadge } from "@/components/ui/Badge";
import { DEMO_WORKERS } from "@/lib/viewer/demoData";

function WorkersInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("");
  const selectedId = params.get("worker");
  const teams = [...new Set(DEMO_WORKERS.map((w) => w.team))];

  return (
    <ViewerGate>
      {({ data, stats, workerRequests, approveWorkerRequest }) => {
        const rows = stats.workload.filter((r) => (!team || r.worker.team === team) && (!q.trim() || `${r.worker.name} ${r.worker.team} ${r.worker.skills.join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())));
        const chips: FilterChip[] = team ? [{ key: "team", label: team, onRemove: () => setTeam("") }] : [];
        const selected = stats.workload.find((r) => r.worker.id === selectedId);
        const tasks = selected ? data.issues.filter((i) => i.assignedTo === selected.worker.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6) : [];

        return (
          <>
            <PageHeader title="Workers" description="Workload, speed, ratings and earnings for each worker, plus requests for worker access." />

            {workerRequests.length > 0 && (
              <SectionCard title="Requests for worker access" description="People appear here after registering as a worker. Only an administrator can approve them." className="mb-6" flush>
                <ul className="divide-y divide-border">
                  {workerRequests.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={r.name} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg">{r.name}</span>
                          <span className="block text-[13px] text-fg-subtle">Wants to join {r.team}</span>
                        </span>
                      </span>
                      <span className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => approveWorkerRequest(r.id, false)}>
                          Decline
                        </Button>
                        <Button size="sm" onClick={() => approveWorkerRequest(r.id, true)}>
                          Approve
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            <Card className="mb-4 p-3 sm:p-4">
              <FilterBar search={q} onSearch={setQ} searchLabel="Search workers" placeholder="Search by name, team or skill" chips={chips} onClear={() => setTeam("")}>
                <Select size="sm" aria-label="Team" value={team} onChange={(e) => setTeam(e.target.value)} wrapperClassName="w-auto">
                  <option value="">All teams</option>
                  {teams.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </FilterBar>
            </Card>

            <Card className="overflow-hidden" data-tour="workers-table">
              {rows.length === 0 ? (
                <EmptyState title="No workers match" description="Try clearing the search or the team filter." />
              ) : (
                <TableWrap label="Workers">
                  <thead>
                    <tr>
                      {["Worker", "Team", "Active", "Resolved", "Avg resolution", "Rating", "Paid out"].map((h) => (
                        <th key={h} scope="col" className={th}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.worker.id} className={trHover}>
                        <th scope="row" className={`${td} text-left`}>
                          <button type="button" onClick={() => router.replace(`/viewer/workers?worker=${r.worker.id}`)} className="flex items-center gap-2.5 rounded-md text-left font-medium text-fg hover:text-brand-fg">
                            <Avatar name={r.worker.name} />
                            {r.worker.name}
                          </button>
                        </th>
                        <td className={`${td} whitespace-nowrap text-fg-muted`}>{r.worker.team}</td>
                        <td className={`${td} tabular`}>{r.active}</td>
                        <td className={`${td} tabular`}>{r.resolved}</td>
                        <td className={`${td} tabular`}>{formatHours(r.averageResolutionHours) ?? "—"}</td>
                        <td className={`${td} tabular`}>
                          {r.rating === null ? (
                            <span className="text-fg-subtle">Not enough ratings</span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden="true" />
                              {r.rating}
                              <span className="text-xs text-fg-subtle">({r.ratingCount})</span>
                            </span>
                          )}
                        </td>
                        <td className={`${td} tabular`}>{r.earnings ? currency(r.earnings) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Card>

            <Drawer open={!!selected} onClose={() => router.replace("/viewer/workers")} title={selected?.worker.name ?? "Worker"}>
              {selected && (
                <div className="space-y-5 p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={selected.worker.name} size={44} />
                    <div>
                      <p className="text-sm font-medium text-fg">{selected.worker.team}</p>
                      <p className="text-[13px] text-fg-subtle">{selected.worker.shift} shift</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.worker.skills.map((s) => (
                      <Badge key={s} tone="info">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <DescriptionList
                    columns={2}
                    items={[
                      { label: "Active tasks", value: selected.active },
                      { label: "Resolved", value: selected.resolved },
                      { label: "Avg resolution", value: formatHours(selected.averageResolutionHours) ?? "—" },
                      { label: "Paid out", value: selected.earnings ? currency(selected.earnings) : "—" },
                    ]}
                  />
                  <div>
                    <h3 className="mb-1.5 text-[13px] font-semibold text-fg">Recent tasks</h3>
                    <ul className="divide-y divide-border">
                      {tasks.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                          <Link href={`/viewer/issues/${t.id}`} className="min-w-0 truncate text-sm text-fg hover:text-brand-fg">
                            {t.title}
                          </Link>
                          <StatusBadge status={t.status} />
                        </li>
                      ))}
                      {tasks.length === 0 && <li className="py-2 text-[13px] text-fg-subtle">No tasks yet.</li>}
                    </ul>
                  </div>
                </div>
              )}
            </Drawer>
          </>
        );
      }}
    </ViewerGate>
  );
}

export default function ViewerWorkersPage() {
  return (
    <Suspense fallback={<ViewerLoading />}>
      <WorkersInner />
    </Suspense>
  );
}
