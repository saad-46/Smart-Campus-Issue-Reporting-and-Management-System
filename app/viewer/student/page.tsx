"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Clock, FilePlus2, Hammer, Star } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Button, { buttonClasses } from "@/components/ui/Button";
import { KpiCard, KpiGrid } from "@/components/ui/Kpi";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/States";
import { SectionCard, DemoIssueList, ViewerGate } from "@/components/viewer/parts";
import { RateDialog } from "@/components/viewer/ActionDialogs";
import { DEMO_PERSONA, DemoIssue } from "@/lib/viewer/demoData";
import { byNewest, studentIssues } from "@/lib/viewer/demoStats";
import { greeting } from "@/lib/dates";

type Tab = "mine" | "community";

export default function ViewerStudentPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [rating, setRating] = useState<DemoIssue | null>(null);

  return (
    <ViewerGate>
      {({ data, slaConfig }) => {
        const mine = byNewest(studentIssues(data));
        const open = mine.filter((i) => i.status === "Open");
        const progress = mine.filter((i) => i.status === "In Progress");
        const resolved = mine.filter((i) => i.status === "Resolved");
        const toRate = resolved.filter((i) => !i.feedback);
        const community = byNewest(data.issues.filter((i) => !i.mine && i.status !== "Resolved")).slice(0, 12);
        const shown = tab === "mine" ? mine : community;

        return (
          <>
            <PageHeader
              eyebrow={DEMO_PERSONA.student.department + " · " + DEMO_PERSONA.student.year}
              title={`${greeting(data.now)}, ${DEMO_PERSONA.student.name.split(" ")[0]}`}
              description="Your reports, their progress and anything waiting for you."
              actions={
                <Link href="/viewer/report" className={buttonClasses("primary")}>
                  <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                  Report an issue
                </Link>
              }
            />

            <div data-tour="student-kpis" className="mb-6">
              <KpiGrid className="xl:grid-cols-4">
                <KpiCard label="My reports" value={mine.length} icon={<ClipboardList />} hint="All time in this demo" />
                <KpiCard label="Waiting" value={open.length} icon={<Clock />} tone="warning" hint="Not started yet" />
                <KpiCard label="In progress" value={progress.length} icon={<Hammer />} tone="brand" hint="A worker is on it" />
                <KpiCard label="Resolved" value={resolved.length} icon={<CheckCircle2 />} tone="success" hint={toRate.length ? `${toRate.length} to rate` : "All rated"} />
              </KpiGrid>
            </div>

            {toRate.length > 0 && (
              <SectionCard title="Rate the fix" description="Tell us how it went. It helps assign the right worker next time." className="mb-6">
                <ul className="divide-y divide-border">
                  {toRate.map((i) => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{i.title}</p>
                        <p className="text-[13px] text-fg-subtle">{i.resolutionSummary}</p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => setRating(i)} icon={<Star className="h-3.5 w-3.5" aria-hidden="true" />}>
                        Rate this fix
                      </Button>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            <SectionCard title="Issues" flush>
              <div className="px-4 sm:px-5">
                <Tabs
                  value={tab}
                  onChange={setTab}
                  label="Issue lists"
                  panelId="student-issues"
                  options={[
                    { value: "mine", label: "My issues", count: mine.length },
                    { value: "community", label: "Community", count: community.length },
                  ]}
                />
              </div>
              <div id="student-issues" role="tabpanel" aria-labelledby={`student-issues-tab-${tab}`}>
                {shown.length === 0 ? (
                  <EmptyState title="No issues here yet" description="Report a campus issue and follow it from this page." action={<Link href="/viewer/report" className={buttonClasses("primary")}>Report an issue</Link>} />
                ) : (
                  <DemoIssueList issues={shown} now={data.now} config={slaConfig} label={tab === "mine" ? "My issues" : "Community issues"} />
                )}
              </div>
              {tab === "community" && (
                <p className="border-t border-border px-4 py-3 text-[13px] text-fg-subtle sm:px-5">
                  Other people&apos;s reports. If you see the same problem, upvote it instead of filing it again.{" "}
                  <Link href="/viewer/issues" className="font-medium text-brand-fg hover:underline">
                    See all
                  </Link>
                </p>
              )}
            </SectionCard>

            <RateDialog issue={rating} onClose={() => setRating(null)} />
          </>
        );
      }}
    </ViewerGate>
  );
}
