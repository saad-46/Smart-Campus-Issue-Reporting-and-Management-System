"use client";

import React, { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Feedback, Issue } from "@/types";
import { FEEDBACK_COMMENT_MAX, getFeedback, submitFeedback } from "@/lib/feedback";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { SkeletonLines } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import Panel from "./Panel";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

function Stars({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden="true" className={cn(size === "sm" ? "h-4 w-4" : "h-5 w-5", n <= rating ? "fill-warning text-warning" : "text-border-strong")} />
      ))}
    </span>
  );
}

/**
 * Resolution feedback. The reporter can rate a resolved issue once (the
 * database rules enforce "own issue, once, after resolution"); admins can
 * read it. Nobody else is shown this panel.
 */
export default function FeedbackPanel({ issue, userId, isAdmin }: { issue: Issue; userId: string; isAdmin: boolean }) {
  const isReporter = issue.createdBy === userId;
  const toast = useToast();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // After submitting, the form is replaced by the saved rating: move focus there.
  const resultRef = useRef<HTMLDivElement>(null);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (justSaved) resultRef.current?.focus({ preventScroll: true });
  }, [justSaved]);

  const resolved = issue.status === "Resolved";
  const visible = resolved && (isReporter || isAdmin);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoaded(false);
    getFeedback(issue.id)
      .then((f) => {
        if (!cancelled) setFeedback(f);
      })
      .catch((err) => logError("getFeedback", err))
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [issue.id, visible]);

  if (!visible) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitFeedback(issue, userId, rating, comment);
      setFeedback({ issueId: issue.id, rating, comment: comment.trim(), createdBy: userId, assignedTo: issue.assignedTo, category: issue.category, createdAt: new Date() });
      toast.success("Thanks for your feedback", "It helps the maintenance team improve.");
      setJustSaved(true);
    } catch (err) {
      logError("submitFeedback", err);
      setError(getFriendlyErrorMessage(err, "Your feedback couldn't be saved. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  // Radio-group keyboard behaviour: arrows change the rating.
  const onStarKey = (e: React.KeyboardEvent, n: number) => {
    let next = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(5, n + 1);
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(1, n - 1);
    if (next) {
      e.preventDefault();
      setRating(next);
      starRefs.current[next - 1]?.focus();
    }
  };

  const shown = hover || rating;

  return (
    <Panel id="feedback" title={isReporter && !feedback ? "How was this issue handled?" : "Resolution feedback"}>
      {!loaded ? (
        <SkeletonLines lines={2} />
      ) : feedback ? (
        <div ref={resultRef} tabIndex={-1} className="outline-none">
          <div className="flex items-center gap-2">
            <Stars rating={feedback.rating} />
            <span className="text-sm text-fg-muted">{LABELS[feedback.rating]}</span>
          </div>
          {feedback.comment && <p className="mt-2 break-words text-sm text-fg">{feedback.comment}</p>}
          <p className="mt-2 text-xs text-fg-subtle">{isReporter ? "Thanks — you rated this resolution." : "Rating left by the reporter."}</p>
        </div>
      ) : isReporter ? (
        <form onSubmit={submit} className="space-y-3">
          <div>
            <div role="radiogroup" aria-label="Rating" className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  ref={(el) => {
                    starRefs.current[n - 1] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n === 1 ? "" : "s"} — ${LABELS[n]}`}
                  tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  onKeyDown={(e) => onStarKey(e, n)}
                  className="rounded-md p-1 transition-colors hover:bg-warning-subtle active:translate-y-px"
                >
                  <Star aria-hidden="true" className={cn("h-6 w-6 transition-colors", n <= shown ? "fill-warning text-warning" : "text-border-strong")} />
                </button>
              ))}
              <span className="ml-2 text-sm text-fg-muted" aria-hidden="true">
                {LABELS[shown]}
              </span>
            </div>
          </div>
          <Textarea
            label="Tell us more"
            aside="Optional"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={FEEDBACK_COMMENT_MAX}
            rows={3}
          />
          {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-fg-subtle">You can rate each resolved issue once.</p>
            <Button type="submit" size="sm" isLoading={submitting}>
              Submit feedback
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-[13px] text-fg-subtle">The reporter hasn&apos;t rated this resolution yet.</p>
      )}
    </Panel>
  );
}
