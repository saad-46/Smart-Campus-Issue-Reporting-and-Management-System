"use client";

import React, { useState } from "react";
import { Plus, QrCode, Star } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { StatStrip } from "@/components/ui/Data";
import { Tabs, tabId } from "@/components/ui/Tabs";
import { useViewer } from "@/components/viewer/ViewerProvider";
import { DemoIssueList, SampleNote, SignInHint, ViewerLoading, WorkflowSteps } from "@/components/viewer/parts";
import { Stars } from "@/components/viewer/SampleIssueDialog";
import { studentIssues } from "@/lib/viewer/demoStats";

export default function ViewerStudentPage() {
  const { data, promptSignIn } = useViewer();
  const [tab, setTab] = useState<"mine" | "community">("mine");

  const header = (
    <PageHeader
      eyebrow="Student view · sample"
      title="My issues"
      description="Track what you've reported, from submitted to resolved."
      actions={
        <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => promptSignIn("Reporting an issue")}>
          Report an issue
        </Button>
      }
    />
  );

  if (!data) return (<>{header}<ViewerLoading /></>);

  const mine = studentIssues(data);
  const list = tab === "mine" ? mine : [...data.issues].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const rated = mine.find((i) => i.feedback);

  return (
    <>
      {header}
      <SampleNote>
        This is how a student&apos;s dashboard looks. The issues belong to a sample student account; open any of them to see its timeline, deadline and
        resolution.
      </SampleNote>

      <StatStrip
        className="mb-6"
        stats={[
          { label: "Open", value: mine.filter((i) => i.status === "Open").length, hint: "Waiting to be picked up" },
          { label: "In progress", value: mine.filter((i) => i.status === "In Progress").length, hint: "A worker is on it" },
          { label: "Resolved", value: mine.filter((i) => i.status === "Resolved").length, hint: "Marked as fixed" },
        ]}
      />

      <Card className="mb-6">
        <div className="px-4 pt-2 sm:px-5">
          <h2 className="sr-only">Issue lists</h2>
          <Tabs
            label="Issue lists"
            value={tab}
            onChange={setTab}
            panelId="viewer-student-panel"
            className="border-b-0"
            options={[
              { value: "mine", label: "My issues", count: mine.length },
              { value: "community", label: "Community", count: data.issues.length },
            ]}
          />
        </div>
        <div id="viewer-student-panel" role="tabpanel" aria-labelledby={tabId("viewer-student-panel", tab)} className="border-t border-border">
          <DemoIssueList issues={list} now={data.now} label={tab === "mine" ? "Issues reported by the sample student" : "All sample issues"} />
        </div>
      </Card>

      <section aria-labelledby="student-flow" className="mb-6">
        <h2 id="student-flow" className="mb-3 text-[15px] font-semibold text-fg">
          From report to feedback
        </h2>
        <WorkflowSteps
          label="Student workflow"
          steps={[
            { title: "Report", text: "Describe the problem and where it is, with optional photos." },
            { title: "Track", text: "Follow the status, deadline and timeline as it updates live." },
            { title: "Resolve", text: "A worker fixes it and marks it resolved — you're notified." },
            { title: "Give feedback", text: "Rate the fix once, from 1 to 5 stars." },
          ]}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Report from a QR code" description="Posters at campus locations" />
          <div className="flex gap-3 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            <QrCode className="h-8 w-8 shrink-0 text-fg-subtle" aria-hidden="true" />
            <p className="text-sm text-fg-muted">
              Administrators print a QR code for each lab, washroom or classroom. Scanning it opens the report form with that location already filled in;
              signing in is still required before anything is submitted.
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Rating a fix" description="Feedback on resolved issues" />
          <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
            {rated?.feedback ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-fg">{rated.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={rated.feedback.rating} />
                  {rated.feedback.comment && <span className="text-sm text-fg-muted">“{rated.feedback.comment}”</span>}
                </div>
                <Button variant="secondary" size="sm" className="mt-1 self-start" icon={<Star className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => promptSignIn("Rating a fix")}>
                  Rate a fix
                </Button>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">No rated issues in the sample.</p>
            )}
          </div>
        </Card>
      </div>

      <SignInHint>Want to report a real issue?</SignInHint>
    </>
  );
}
