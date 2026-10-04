"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import PageHeader, { SectionHeader } from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import { StatStrip } from "@/components/ui/Data";
import { buttonClasses } from "@/components/ui/Button";
import { useViewer } from "@/components/viewer/ViewerProvider";
import { ViewerNavIcon } from "@/components/viewer/ViewerShell";
import { VIEWER_PERSPECTIVES } from "@/lib/viewer/nav";
import { SampleNote, SignInHint, ViewerLoading, WorkflowSteps } from "@/components/viewer/parts";
import { LIFECYCLE } from "@/components/viewer/lifecycle";
import { BUILDINGS } from "@/lib/campus";
import { DEMO_WINDOW_DAYS } from "@/lib/viewer/demoStats";

export default function ViewerOverviewPage() {
  const { data, stats } = useViewer();

  return (
    <>
      <PageHeader
        eyebrow="Viewer mode"
        title="Smart Campus Operations"
        description="Explore how campus issues are reported, assigned, resolved and analysed."
      />

      <section aria-labelledby="perspectives" className="mb-8">
        <SectionHeader id="perspectives" title="Choose a perspective" description="Each view is read-only and uses the same sample dataset." />
        <ul className="grid gap-3 md:grid-cols-3">
          {VIEWER_PERSPECTIVES.map((p) => (
            <li key={p.href}>
              <Card className="flex h-full flex-col p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-subtle text-brand-fg [&>svg]:h-[18px] [&>svg]:w-[18px]" aria-hidden="true">
                  <ViewerNavIcon icon={p.icon} />
                </span>
                <h3 className="mt-3 text-[15px] font-semibold text-fg">{p.label}</h3>
                <p className="mt-1 flex-1 text-sm text-fg-muted">{p.summary}</p>
                <Link href={p.href} className={buttonClasses("secondary", "md", "mt-4 self-start")} aria-label={`Explore the ${p.label} view`}>
                  Explore
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="lifecycle" className="mb-8">
        <SectionHeader
          id="lifecycle"
          title="How an issue moves through the system"
          action={
            <Link href="/viewer/how-it-works" className="text-[13px] font-medium text-brand-fg hover:underline">
              Details
            </Link>
          }
        />
        <WorkflowSteps label="Issue lifecycle" steps={LIFECYCLE.map(({ title, short }) => ({ title, text: short }))} />
      </section>

      <section aria-labelledby="dataset">
        <SectionHeader id="dataset" title="The sample dataset" />
        {!data || !stats ? (
          <ViewerLoading />
        ) : (
          <>
            <StatStrip
              stats={[
                { label: "Sample issues", value: stats.total, hint: `Reported over the last ${DEMO_WINDOW_DAYS} days` },
                { label: "Open or in progress", value: stats.status.Open + stats.status["In Progress"], hint: `${stats.status.Resolved} resolved` },
                { label: "Campus buildings", value: BUILDINGS.length, hint: "Schematic layout" },
                { label: "Ratings", value: stats.satisfaction.count, hint: stats.satisfaction.average !== null ? `Average ${stats.satisfaction.average}/5` : "None yet" },
              ]}
            />
            <SampleNote className="mt-4 mb-0">
              Every figure in Viewer Mode is calculated from this sample by the same analytics, SLA and incident logic the real dashboards use. No real
              people, accounts, photos, receipts or payments are included.
            </SampleNote>
          </>
        )}
      </section>

      <SignInHint>Want to report a real issue or manage campus work?</SignInHint>
    </>
  );
}
