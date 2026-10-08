"use client";

import React from "react";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { useNow } from "@/hooks/useNow";
import { SlaBadgeView, SlaMeterView, SlaInput } from "./SlaView";

export { SlaBadgeView, SlaMeterView };

/**
 * SLA state computed live from the issue's timestamps and the configured
 * targets (never stored). `compact` shows the state only; otherwise the
 * time left / overdue is included.
 */
export default function SlaBadge({ issue, compact = false }: { issue: SlaInput; compact?: boolean }) {
  const config = useSlaConfig();
  const now = useNow();
  return <SlaBadgeView issue={issue} config={config} now={now} compact={compact} />;
}

/** Deadline panel: time left (or overdue) with a progress bar of the window used. */
export function SlaMeter({ issue }: { issue: SlaInput }) {
  const config = useSlaConfig();
  const now = useNow();
  return <SlaMeterView issue={issue} config={config} now={now} />;
}

