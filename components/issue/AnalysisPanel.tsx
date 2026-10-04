"use client";

import React, { useMemo } from "react";
import { Issue } from "@/types";
import { analyzeIssueDetails } from "@/services/aiService";
import { departmentFor } from "@/lib/constants";
import Badge from "@/components/ui/Badge";
import Panel from "./Panel";

/**
 * What the automatic (keyword-based) classification suggested for this
 * report. Suggestion only: staff decide, and nothing here changes the issue.
 */
export default function AnalysisPanel({ issue, showConfidence }: { issue: Issue; showConfidence: boolean }) {
  // Deterministic, so re-running it on the stored text reproduces the
  // explanation shown when the report was filed.
  const analysis = useMemo(
    () => analyzeIssueDetails({ title: issue.title, description: issue.description, location: issue.location }),
    [issue.title, issue.description, issue.location]
  );
  const recorded = issue.aiConfidence !== null;
  const department = issue.aiDepartment || departmentFor(issue.category);
  const summary = issue.aiSummary || analysis.summary;
  const confidence = issue.aiConfidence ?? analysis.confidence;
  const changedByStaff = analysis.category !== issue.category;

  return (
    <Panel title="Suggested classification" badge={<Badge>Keyword-based</Badge>}>
      <div className="space-y-3 text-sm">
        {summary && <p className="text-fg">{summary}</p>}
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-fg-subtle">Handled by</dt>
            <dd className="mt-0.5 text-fg">{department}</dd>
          </div>
          {showConfidence && (
            <div title="How clearly the keywords pointed to one category — not a probability.">
              <dt className="text-xs text-fg-subtle">Match strength</dt>
              <dd className="tabular mt-0.5 text-fg">
                {Math.round(confidence * 100)}%<span className="sr-only"> heuristic confidence, not a calibrated probability</span>
              </dd>
            </div>
          )}
        </dl>
        <p className="text-[13px] text-fg-muted">{analysis.explanation}</p>
        {changedByStaff && (
          <p className="text-[13px] text-fg-subtle">
            Suggested {analysis.category}; currently filed as {issue.category}.
          </p>
        )}
        {!recorded && <p className="text-xs text-fg-subtle">Reported before suggestions were stored — re-computed from the report text.</p>}
      </div>
    </Panel>
  );
}
