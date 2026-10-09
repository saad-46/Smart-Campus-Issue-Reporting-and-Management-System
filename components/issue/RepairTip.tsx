"use client";

import React, { useEffect, useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import { getSuggestedSolution } from "@/services/aiAssistService";
import { logError } from "@/lib/errors";

/**
 * Keyword-based repair tip, collapsed by default so a task list stays
 * scannable. Shared by the signed-in worker page and Explore Mode: it is
 * computed in the browser from the report's own text.
 */
export default function RepairTip({ issue }: { issue: { description: string; category: string; location: string } }) {
  const [tip, setTip] = useState("");
  const { description, category, location } = issue;
  useEffect(() => {
    let cancelled = false;
    getSuggestedSolution({ description, category, location })
      .then((text) => {
        if (!cancelled) setTip(text);
      })
      .catch((e) => logError("getSuggestedSolution", e));
    return () => {
      cancelled = true;
    };
  }, [description, category, location]);
  if (!tip) return null;
  return (
    <details className="group/tip text-[13px]">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-fg-subtle hover:text-fg">
        <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
        Suggested checks
        <span className="text-xs">(keyword-based tip)</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/tip:rotate-180" aria-hidden="true" />
      </summary>
      <p className="mt-1.5 max-w-2xl rounded-md border border-border bg-surface-2/60 px-3 py-2 text-fg-muted">{tip}</p>
    </details>
  );
}
