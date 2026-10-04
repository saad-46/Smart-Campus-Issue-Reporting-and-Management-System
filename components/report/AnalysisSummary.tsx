"use client";

import React, { useId } from "react";
import { Info, Sparkle } from "lucide-react";
import { IssueIntelligence } from "@/services/aiService";
import { PriorityBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

function strength(confidence: number): { label: string; bars: number } {
  if (confidence >= 0.75) return { label: "Strong match", bars: 3 };
  if (confidence >= 0.5) return { label: "Moderate match", bars: 2 };
  return { label: "Weak match", bars: 1 };
}

/**
 * The automatic suggestion for a new report, presented as a suggestion:
 * what was inferred, why, and that staff can change it. Updates as the
 * reporter types. Keyword-based — no language model.
 */
export default function AnalysisSummary({
  analysis,
  unavailable,
  empty,
  className,
}: {
  analysis: IssueIntelligence | null;
  unavailable?: boolean;
  /** True until the reporter has typed enough to analyse. */
  empty?: boolean;
  className?: string;
}) {
  const s = analysis ? strength(analysis.confidence) : null;
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("rounded-lg border border-border bg-surface", className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Sparkle className="h-4 w-4 text-brand-fg" aria-hidden="true" />
        <h2 id={headingId} className="text-sm font-semibold text-fg">
          Suggested details
        </h2>
      </div>
      <p className="sr-only" aria-live="polite">
        {analysis && !empty && !unavailable ? `Suggested category ${analysis.category}, ${analysis.priority} priority.` : ""}
      </p>
      {empty || !analysis ? (
        <p className="px-4 py-5 text-[13px] text-fg-subtle">
          Describe the problem and a category, priority and responsible team will be suggested here.
        </p>
      ) : unavailable ? (
        <p className="px-4 py-5 text-[13px] text-fg-muted">
          Suggestions aren&apos;t available right now. Your report will be filed as General and staff will categorise it.
        </p>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-xs text-fg-subtle">Category</dt>
              <dd className="mt-0.5 text-sm font-medium text-fg">{analysis.category}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-subtle">Priority</dt>
              <dd className="mt-1">
                <PriorityBadge priority={analysis.priority} />
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-fg-subtle">Handled by</dt>
              <dd className="mt-0.5 text-sm text-fg">{analysis.department}</dd>
            </div>
          </dl>
          {s && (
            <div className="flex items-center gap-2 text-xs text-fg-subtle" title={`Heuristic confidence ${Math.round(analysis.confidence * 100)}% — how clearly the keywords point to one category; not a probability.`}>
              <span aria-hidden="true" className="flex items-end gap-[2px]">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={cn("w-1 rounded-[1px]", n <= s.bars ? "bg-brand-fg" : "bg-border-strong")} style={{ height: 4 + n * 3 }} />
                ))}
              </span>
              {s.label}
              <span className="sr-only">(heuristic confidence {Math.round(analysis.confidence * 100)}%, not a probability)</span>
            </div>
          )}
          <p className="text-[13px] leading-relaxed text-fg-muted">{analysis.explanation}</p>
          <p className="flex gap-1.5 border-t border-border pt-3 text-xs text-fg-subtle">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Based on keywords in your report. Maintenance staff review and can change it.
          </p>
        </div>
      )}
    </section>
  );
}
