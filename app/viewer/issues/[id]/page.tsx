"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MapPin, Play, Receipt, Sparkles, ThumbsUp, UserPlus, Star, TriangleAlert, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { DescriptionList } from "@/components/ui/Data";
import { EmptyState } from "@/components/ui/States";
import Panel from "@/components/issue/Panel";
import { SlaMeterView } from "@/components/issue/SlaView";
import { currency } from "@/components/admin/Kpi";
import { ViewerGate } from "@/components/viewer/parts";
import { AssignDialog, ClaimDialog, PayDialog, RateDialog, ResolveDialog } from "@/components/viewer/ActionDialogs";
import { EventTimeline } from "@/components/viewer/Timeline";
import { IssuePhoto, ReceiptPreview } from "@/components/viewer/DemoImage";
import { analyzeIssueDetails } from "@/services/aiService";
import { DEMO_PERSONA, DemoIssue, demoTimeline, workerName } from "@/lib/viewer/demoData";
import { formatDate, formatRelative } from "@/lib/dates";
import { departmentFor } from "@/lib/constants";

const CLAIM_TONE = { pending: "warning", approved: "success", rejected: "danger" } as const;
const CLAIM_LABEL = { pending: "Awaiting review", approved: "Approved and paid", rejected: "Rejected" } as const;

function NotInDemo({ id }: { id: string }) {
  return (
    <Card>
      <EmptyState
        title="That issue isn't in the demo"
        description={`${id} doesn't match any sample issue. The demo has SC-1000 to SC-1145 and anything you create during this visit.`}
        action={
          <Link href="/viewer/issues" className="text-sm font-medium text-brand-fg hover:underline">
            Browse all issues
          </Link>
        }
      />
    </Card>
  );
}

export default function ViewerIssuePage() {
  const { id } = useParams<{ id: string }>();
  const [dialog, setDialog] = useState<null | "assign" | "resolve" | "claim" | "pay" | "rate">(null);

  return (
    <ViewerGate>
      {({ data, slaConfig, role, startIssue, assignIssue, upvoteIssue }) => {
        const issue = data.issues.find((i) => i.id === id);
        if (!issue) return <NotInDemo id={String(id)} />;
        return <Detail issue={issue} now={data.now} dialog={dialog} setDialog={setDialog} slaConfig={slaConfig} role={role} startIssue={startIssue} assignIssue={assignIssue} upvoteIssue={upvoteIssue} allIssues={data.issues} />;
      }}
    </ViewerGate>
  );
}

function Detail({
  issue,
  now,
  dialog,
  setDialog,
  slaConfig,
  role,
  startIssue,
  assignIssue,
  upvoteIssue,
  allIssues,
}: {
  issue: DemoIssue;
  now: Date;
  dialog: null | "assign" | "resolve" | "claim" | "pay" | "rate";
  setDialog: (d: null | "assign" | "resolve" | "claim" | "pay" | "rate") => void;
  slaConfig: Parameters<typeof SlaMeterView>[0]["config"];
  role: "student" | "worker" | "admin";
  startIssue: (id: string) => void;
  assignIssue: (id: string, workerId: string) => void;
  upvoteIssue: (id: string) => void;
  allIssues: DemoIssue[];
}) {
  const analysis = useMemo(() => analyzeIssueDetails({ title: issue.title, description: issue.description, location: issue.location }), [issue.title, issue.description, issue.location]);
  const events = demoTimeline(issue, now);
  const related = allIssues.filter((i) => i.duplicateOf === issue.id || (issue.duplicateOf && (i.id === issue.duplicateOf || i.duplicateOf === issue.duplicateOf) && i.id !== issue.id));
  const nextStep = issue.status === "Open" ? (issue.assignedTo ? "Work starts" : "A worker is assigned") : issue.status === "In Progress" ? "Marked resolved" : undefined;
  const iAmWorker = role === "worker" && (issue.assignedTo === DEMO_PERSONA.worker.id || !issue.assignedTo);

  return (
    <>
      <Link href="/viewer/issues" className="mb-4 inline-flex items-center gap-1 text-[13px] font-medium text-fg-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        All issues
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="tabular font-mono text-xs text-fg-subtle">{issue.id}</span>
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          <Badge>{issue.category}</Badge>
          {issue.escalated && (
            <Badge tone="danger" icon={<TriangleAlert aria-hidden="true" />}>
              Escalated
            </Badge>
          )}
          {issue.simulated && <Badge tone="info">Created in this demo</Badge>}
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-fg sm:text-2xl">{issue.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-fg-muted">
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          {issue.location}
          <span aria-hidden="true">·</span>
          reported {formatRelative(issue.createdAt, now)}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            {issue.hasPhoto && (
              <div className="aspect-[16/7] w-full border-b border-glass-border">
                <IssuePhoto category={issue.category} seed={issue.id} alt={`Sample illustration for ${issue.title}`} />
              </div>
            )}
            <div className="p-4 sm:p-5">
              <h2 className="text-sm font-semibold text-fg">Description</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{issue.description}</p>
              {!issue.hasPhoto && <p className="mt-3 text-[13px] text-fg-subtle">No photo was attached to this report.</p>}
            </div>
          </Card>

          <Panel title="Analysis" badge={<Badge tone="info" icon={<Sparkles aria-hidden="true" />}>Suggestion</Badge>} description="Rule-based, not a language model. People can change it.">
            <p className="text-sm text-fg-muted">{analysis.explanation}</p>
            <DescriptionList
              className="mt-3"
              columns={2}
              items={[
                { label: "Suggested team", value: departmentFor(issue.category) },
                { label: "Confidence", value: `${Math.round(issue.aiConfidence * 100)}% (heuristic)` },
              ]}
            />
          </Panel>

          {related.length > 0 && (
            <Panel title="Related reports" badge={<Badge tone="warning" icon={<Users aria-hidden="true" />}>Incident</Badge>} description="Reports of the same fault, linked so it is fixed once.">
              <ul className="divide-y divide-border">
                {related.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                    <Link href={`/viewer/issues/${r.id}`} className="min-w-0 truncate text-sm text-fg hover:text-brand-fg">
                      {r.title}
                    </Link>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {issue.status === "Resolved" && (
            <Panel title="Resolution" description={issue.resolvedAt ? `Resolved ${formatDate(issue.resolvedAt, { month: "short", day: "numeric" })}` : undefined}>
              <p className="text-sm text-fg-muted">{issue.resolutionSummary || "Marked resolved."}</p>
              {issue.feedback && (
                <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                  <span className="flex" role="img" aria-label={`Rated ${issue.feedback.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={n <= issue.feedback!.rating ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4 text-border-strong"} aria-hidden="true" />
                    ))}
                  </span>
                  {issue.feedback.comment && <span>&ldquo;{issue.feedback.comment}&rdquo;</span>}
                </p>
              )}
            </Panel>
          )}

          {issue.claim && (role === "admin" || (role === "worker" && issue.assignedTo === DEMO_PERSONA.worker.id)) && (
            <Panel title="Expense claim" badge={<Badge tone={CLAIM_TONE[issue.claim.status]} dot>{CLAIM_LABEL[issue.claim.status]}</Badge>} description="Receipts are visible only to the worker and administrators.">
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <DescriptionList
                  items={[
                    { label: "Amount", value: <span className="tabular font-semibold">{currency(issue.claim.amount)}</span> },
                    { label: "Spent on", value: issue.claim.description },
                    { label: "Worker", value: workerName(issue.assignedTo) },
                  ]}
                />
                <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border">
                  <ReceiptPreview shop="Campus Hardware" item={issue.claim.description} amount={issue.claim.amount} />
                </div>
              </div>
            </Panel>
          )}

          <Panel title="Timeline" description="Every recorded step" >
            <div data-tour="issue-timeline">
              <EventTimeline events={events} pending={nextStep} />
            </div>
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Deadline">
            <div data-tour="issue-sla">
              <SlaMeterView issue={issue} config={slaConfig} now={now} />
            </div>
          </Panel>

          <Panel title="Details">
            <DescriptionList
              items={[
                { label: "Assigned to", value: issue.assignedTo ? workerName(issue.assignedTo) : <span className="text-fg-subtle">Unassigned</span> },
                { label: "Reported by", value: issue.mine ? "You" : role === "student" ? "Another student" : issue.reporterName },
                { label: "Upvotes", value: issue.upvotes },
                { label: "Category", value: issue.category },
              ]}
            />
          </Panel>

          <Panel title="Actions" description="Demo only: nothing is saved.">
            <div className="flex flex-col gap-2">
              {role === "admin" && (
                <div data-tour="issue-assign" className="flex flex-col gap-2">
                  {issue.status !== "Resolved" && (
                    <Button variant={issue.assignedTo ? "secondary" : "primary"} onClick={() => setDialog("assign")} icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}>
                      {issue.assignedTo ? "Reassign worker" : "Assign worker"}
                    </Button>
                  )}
                  {issue.claim?.status === "pending" && (
                    <Button onClick={() => setDialog("pay")} icon={<Receipt className="h-4 w-4" aria-hidden="true" />}>
                      Review claim
                    </Button>
                  )}
                  {issue.status === "Resolved" && !issue.claim && <p className="text-[13px] text-fg-subtle">Nothing to do: this issue is resolved.</p>}
                </div>
              )}
              {role === "worker" && (
                <>
                  {!issue.assignedTo && issue.status !== "Resolved" && (
                    <Button onClick={() => assignIssue(issue.id, DEMO_PERSONA.worker.id)}>Take this task</Button>
                  )}
                  {iAmWorker && issue.assignedTo && issue.status === "Open" && (
                    <Button onClick={() => startIssue(issue.id)} icon={<Play className="h-4 w-4" aria-hidden="true" />}>
                      Start work
                    </Button>
                  )}
                  {iAmWorker && issue.status === "In Progress" && (
                    <Button onClick={() => setDialog("resolve")} icon={<CheckCircle2 className="h-4 w-4" aria-hidden="true" />}>
                      Mark resolved
                    </Button>
                  )}
                  {issue.assignedTo === DEMO_PERSONA.worker.id && issue.status === "Resolved" && !issue.claim && (
                    <Button variant="secondary" onClick={() => setDialog("claim")} icon={<Receipt className="h-4 w-4" aria-hidden="true" />}>
                      Submit expense claim
                    </Button>
                  )}
                  {!iAmWorker && <p className="text-[13px] text-fg-subtle">This task belongs to {workerName(issue.assignedTo)}.</p>}
                </>
              )}
              {role === "student" && (
                <>
                  {!issue.mine && issue.status !== "Resolved" && (
                    <Button variant="secondary" onClick={() => upvoteIssue(issue.id)} icon={<ThumbsUp className="h-4 w-4" aria-hidden="true" />}>
                      Upvote ({issue.upvotes})
                    </Button>
                  )}
                  {issue.mine && issue.status === "Resolved" && !issue.feedback && (
                    <Button onClick={() => setDialog("rate")} icon={<Star className="h-4 w-4" aria-hidden="true" />}>
                      Rate this fix
                    </Button>
                  )}
                  {issue.mine && issue.status !== "Resolved" && <p className="text-[13px] text-fg-subtle">You&apos;ll be notified when the status changes.</p>}
                  {!issue.mine && issue.status === "Resolved" && <p className="text-[13px] text-fg-subtle">Only the reporter can rate this fix.</p>}
                </>
              )}
            </div>
          </Panel>
        </aside>
      </div>

      <AssignDialog issue={dialog === "assign" ? issue : null} onClose={() => setDialog(null)} />
      <ResolveDialog issue={dialog === "resolve" ? issue : null} onClose={() => setDialog(null)} />
      <ClaimDialog issue={dialog === "claim" ? issue : null} onClose={() => setDialog(null)} />
      <PayDialog issue={dialog === "pay" ? issue : null} onClose={() => setDialog(null)} />
      <RateDialog issue={dialog === "rate" ? issue : null} onClose={() => setDialog(null)} />
    </>
  );
}
