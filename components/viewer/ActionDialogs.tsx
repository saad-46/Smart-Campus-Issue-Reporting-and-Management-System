"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlaskConical, Star } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import { recommendWorkers } from "@/lib/intelligence/assignment";
import { DemoIssue, DEMO_WORKERS, workerName } from "@/lib/viewer/demoData";
import { LIMITS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { ReceiptPreview } from "./DemoImage";
import { useViewer } from "./viewerContext";

/** Banner used by every simulated action so nobody thinks something real happened. */
function DemoNote({ children }: { children?: React.ReactNode }) {
  return (
    <Notice tone="info" className="mb-4">
      <span className="flex items-start gap-2">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{children ?? "Demo mode: this simulates the action. Nothing is saved or sent."}</span>
      </span>
    </Notice>
  );
}

interface DialogProps {
  issue: DemoIssue | null;
  onClose: () => void;
}

/** Ranked worker suggestions, exactly as the admin issue page computes them. */
export function AssignDialog({ issue, onClose }: DialogProps) {
  const { data, stats, assignIssue } = useViewer();
  const [choice, setChoice] = useState("");
  const firstRef = useRef<HTMLButtonElement>(null);

  const ranked = useMemo(() => {
    if (!issue || !data || !stats) return [];
    const sums = new Map<string, { total: number; count: number }>();
    for (const i of data.issues) if (i.feedback && i.assignedTo) sums.set(i.assignedTo, { total: (sums.get(i.assignedTo)?.total ?? 0) + i.feedback.rating, count: (sums.get(i.assignedTo)?.count ?? 0) + 1 });
    const ratings = new Map([...sums].map(([id, s]) => [id, { average: Math.round((s.total / s.count) * 10) / 10, count: s.count }]));
    return recommendWorkers(issue, DEMO_WORKERS.map((w) => ({ id: w.id, name: w.name })), stats.rawWorkload, ratings);
  }, [issue, data, stats]);

  useEffect(() => {
    if (issue) setChoice(issue.assignedTo || ranked[0]?.workerId || "");
  }, [issue, ranked]);

  if (!issue) return null;
  return (
    <Dialog
      open
      onClose={onClose}
      title={issue.assignedTo ? "Reassign this issue" : "Assign a worker"}
      description={`${issue.id} · ${issue.title}`}
      initialFocus={firstRef}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!choice}
            onClick={() => {
              assignIssue(issue.id, choice);
              onClose();
            }}
          >
            Assign (demo)
          </Button>
        </>
      }
    >
      <DemoNote />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-fg">Suggested workers for {issue.category}</legend>
        <div className="space-y-2">
          {ranked.slice(0, 5).map((r, i) => (
            <label
              key={r.workerId}
              className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors", choice === r.workerId ? "border-brand bg-brand-subtle" : "border-border hover:bg-surface-hover")}
            >
              <input
                ref={i === 0 ? (firstRef as unknown as React.Ref<HTMLInputElement>) : undefined}
                type="radio"
                name="worker"
                value={r.workerId}
                checked={choice === r.workerId}
                onChange={() => setChoice(r.workerId)}
                className="mt-1 accent-[var(--brand)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-sm font-medium text-fg">
                  {r.name}
                  <span className="tabular text-xs font-normal text-fg-subtle">Match {Math.round(r.score * 100)}%</span>
                </span>
                <span className="mt-0.5 block text-[13px] text-fg-subtle">{r.reason}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Dialog>
  );
}

export function ResolveDialog({ issue, onClose }: DialogProps) {
  const { resolveIssue } = useViewer();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (issue) {
      setSummary("");
      setError("");
    }
  }, [issue]);
  if (!issue) return null;
  const submit = () => {
    if (summary.trim().length < 5) {
      setError("Say briefly what was done (at least 5 characters).");
      return;
    }
    resolveIssue(issue.id, summary);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Mark as resolved"
      description={`${issue.id} · ${issue.title}`}
      initialFocus={ref}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Resolve (demo)</Button>
        </>
      }
    >
      <DemoNote />
      <Textarea
        ref={ref}
        label="What was done?"
        value={summary}
        onChange={(e) => {
          setSummary(e.target.value);
          setError("");
        }}
        error={error}
        rows={3}
        maxLength={LIMITS.description}
        hint="The reporter sees this when they rate the fix."
      />
    </Dialog>
  );
}

export function ClaimDialog({ issue, onClose }: DialogProps) {
  const { submitClaim } = useViewer();
  const ref = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState("");
  const [what, setWhat] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; what?: string }>({});
  useEffect(() => {
    if (issue) {
      setAmount("");
      setWhat("");
      setErrors({});
    }
  }, [issue]);
  if (!issue) return null;
  const submit = () => {
    const value = Number(amount);
    const next: typeof errors = {};
    if (!Number.isFinite(value) || value <= 0 || value > LIMITS.maxClaimAmount) next.amount = "Enter an amount above ₹0.";
    if (what.trim().length < 3) next.what = "Say what the money was spent on.";
    setErrors(next);
    if (Object.keys(next).length) return;
    submitClaim(issue.id, Math.round(value * 100) / 100, what);
    onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Submit an expense claim"
      description={`${issue.id} · ${issue.title}`}
      initialFocus={ref}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Submit claim (demo)</Button>
        </>
      }
    >
      <DemoNote>Demo mode: no receipt is uploaded and no money moves.</DemoNote>
      <div className="space-y-3">
        <Input ref={ref} label="Amount spent (₹)" type="number" inputMode="decimal" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
        <Textarea label="What was it spent on?" value={what} onChange={(e) => setWhat(e.target.value)} error={errors.what} rows={2} maxLength={LIMITS.claimDescription} />
      </div>
    </Dialog>
  );
}

/** Decision on a pending claim. Approving is a demo payment: no transaction exists. */
export function PayDialog({ issue, onClose }: DialogProps) {
  const { decideClaim } = useViewer();
  const ref = useRef<HTMLButtonElement>(null);
  if (!issue?.claim) return null;
  const { claim } = issue;
  return (
    <Dialog
      open
      onClose={onClose}
      title="Review expense claim"
      description={`${issue.id} · ${issue.title}`}
      initialFocus={ref}
      footer={
        <>
          <Button
            variant="danger"
            onClick={() => {
              decideClaim(issue.id, "rejected");
              onClose();
            }}
          >
            Reject (demo)
          </Button>
          <Button
            ref={ref}
            onClick={() => {
              decideClaim(issue.id, "approved");
              onClose();
            }}
          >
            Approve and pay ₹{claim.amount.toLocaleString("en-IN")} (demo)
          </Button>
        </>
      }
    >
      <DemoNote>Demo payment: no real transaction will be created.</DemoNote>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-[13px] text-fg-subtle">Worker</dt>
            <dd className="text-fg">{workerName(issue.assignedTo)}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-fg-subtle">Amount</dt>
            <dd className="tabular text-lg font-semibold text-fg">₹{claim.amount.toLocaleString("en-IN")}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-fg-subtle">Spent on</dt>
            <dd className="text-fg">{claim.description}</dd>
          </div>
        </dl>
        <div className="aspect-[3/4] overflow-hidden rounded-lg border border-border">
          <ReceiptPreview shop="Campus Hardware" item={claim.description} amount={claim.amount} />
        </div>
      </div>
    </Dialog>
  );
}

export function RateDialog({ issue, onClose }: DialogProps) {
  const { rateIssue } = useViewer();
  const ref = useRef<HTMLDivElement>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hover, setHover] = useState(0);
  useEffect(() => {
    if (issue) {
      setRating(0);
      setComment("");
    }
  }, [issue]);
  if (!issue) return null;
  const shown = hover || rating;
  const labels = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];
  return (
    <Dialog
      open
      onClose={onClose}
      title="Rate the fix"
      description={`${issue.id} · ${issue.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={rating === 0}
            onClick={() => {
              rateIssue(issue.id, rating, comment);
              onClose();
            }}
          >
            Submit rating (demo)
          </Button>
        </>
      }
    >
      <DemoNote />
      <div ref={ref} role="radiogroup" aria-label="Rating out of 5" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") setRating(Math.min(5, (rating || 0) + 1));
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") setRating(Math.max(1, (rating || 2) - 1));
            }}
            tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
            className="rounded p-1 transition-transform hover:scale-110"
          >
            <Star className={cn("h-7 w-7 transition-colors", n <= shown ? "fill-warning text-warning" : "text-border-strong")} aria-hidden="true" />
          </button>
        ))}
        <span className="ml-2 text-sm text-fg-muted" aria-live="polite">
          {labels[shown]}
        </span>
      </div>
      <Textarea className="mt-4" label="Comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={500} />
    </Dialog>
  );
}
