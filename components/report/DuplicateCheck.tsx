"use client";

import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ExternalLink, Layers } from "lucide-react";
import { IssueSummary } from "@/types";
import { fetchIssueSummaries } from "@/lib/firestore";
import { DUPLICATE_WINDOW_DAYS, findDuplicates } from "@/lib/intelligence/similarity";
import { QUERY_LIMITS } from "@/lib/constants";
import { formatRelative } from "@/lib/dates";
import { logError } from "@/lib/errors";
import { StatusBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type Candidate = Pick<IssueSummary, "title" | "category" | "location" | "locationId">;

/**
 * Open reports from the last two weeks that look like the same problem.
 * The reporter chooses to link their report or submit it separately;
 * nothing is merged or hidden, and a failed check never blocks reporting.
 * The pool is fetched once (bounded projection) and matched locally.
 */
export default function DuplicateCheck({
  candidate,
  value,
  onChange,
}: {
  candidate: Candidate;
  /** The chosen master issue id ("" = report separately). */
  value: string;
  onChange: (duplicateOf: string) => void;
}) {
  const [pool, setPool] = useState<IssueSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  // Defer a primitive key (not the object, which is new on every render).
  const key = JSON.stringify([candidate.title, candidate.category, candidate.location, candidate.locationId]);
  const deferredKey = useDeferredValue(key);
  const deferred = useMemo<Candidate>(() => {
    const [title, category, location, locationId] = JSON.parse(deferredKey) as string[];
    return { title, category, location, locationId };
  }, [deferredKey]);
  const ready = deferred.title.trim().length >= 4;

  useEffect(() => {
    if (!ready || pool || failed) return;
    let cancelled = false;
    const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000);
    fetchIssueSummaries({ since, max: QUERY_LIMITS.duplicates })
      .then(({ issues }) => {
        if (!cancelled) setPool(issues);
      })
      .catch((err) => {
        logError("duplicateCheck", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, pool, failed]);

  const matches = useMemo(() => (pool && ready ? findDuplicates(deferred, pool) : []), [pool, ready, deferred]);

  // If the chosen issue no longer matches, fall back to "report separately".
  useEffect(() => {
    if (value && !matches.some((m) => (m.issue.duplicateOf || m.issue.id) === value)) onChange("");
  }, [matches, value, onChange]);

  if (failed || matches.length === 0) return null;

  return (
    <fieldset className="rounded-lg border border-warning-border bg-warning-subtle/60 p-4">
      <legend className="sr-only">Possible duplicates</legend>
      <div className="flex gap-2.5">
        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-fg">This may already be reported</p>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Linking your report shows staff how many people are affected. Your report stays yours and you&apos;ll still get updates.
          </p>
          <div className="mt-3 space-y-2" role="radiogroup" aria-label="Is this the same problem?">
            {matches.map(({ issue }) => {
              const target = issue.duplicateOf || issue.id;
              const checked = value === target;
              return (
                <label
                  key={issue.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border bg-surface px-3 py-2.5 transition-colors",
                    checked ? "border-brand ring-1 ring-brand" : "border-border hover:border-border-strong"
                  )}
                >
                  <input type="radio" name="duplicate-choice" checked={checked} onChange={() => onChange(target)} className="mt-1 accent-[var(--brand)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">
                      Same problem as <span className="font-medium">{issue.title}</span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                      <span>{issue.location}</span>
                      <span aria-hidden="true">·</span>
                      <span>reported {formatRelative(issue.createdAt)}</span>
                      <StatusBadge status={issue.status} />
                    </span>
                  </span>
                  <a
                    href={`/issues/${issue.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-fg hover:underline"
                  >
                    View <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                </label>
              );
            })}
            <label
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-md border bg-surface px-3 py-2.5 transition-colors",
                value === "" ? "border-brand ring-1 ring-brand" : "border-border hover:border-border-strong"
              )}
            >
              <input type="radio" name="duplicate-choice" checked={value === ""} onChange={() => onChange("")} className="accent-[var(--brand)]" />
              <span className="text-sm text-fg">It&apos;s a different problem — report it separately</span>
            </label>
          </div>
        </div>
      </div>
    </fieldset>
  );
}
