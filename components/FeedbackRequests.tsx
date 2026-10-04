"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { Issue } from "@/types";
import { getMyRatedIssueIds } from "@/lib/feedback";
import { formatRelative } from "@/lib/dates";
import { logError } from "@/lib/errors";
import Card, { CardHeader } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";

/** The reporter's resolved issues that haven't been rated yet. */
export default function FeedbackRequests({ userId, myIssues }: { userId: string; myIssues: Issue[] }) {
  const [rated, setRated] = useState<Set<string> | null>(null);
  const resolved = useMemo(() => myIssues.filter((i) => i.status === "Resolved" && i.createdBy === userId), [myIssues, userId]);
  const resolvedCount = resolved.length;

  useEffect(() => {
    if (resolvedCount === 0) return;
    let cancelled = false;
    getMyRatedIssueIds(userId)
      .then((ids) => {
        if (!cancelled) setRated(ids);
      })
      .catch((err) => logError("getMyRatedIssueIds", err));
    return () => {
      cancelled = true;
    };
  }, [userId, resolvedCount]);

  if (!rated) return null;
  const pending = resolved
    .filter((i) => !rated.has(i.id))
    .sort((a, b) => (b.resolvedAt?.getTime() ?? 0) - (a.resolvedAt?.getTime() ?? 0));
  if (pending.length === 0) return null;

  return (
    <Card as="section" aria-labelledby="feedback-requests-heading" className="mb-6">
      <CardHeader
        id="feedback-requests-heading"
        title="How did we do?"
        description={`${pending.length} resolved ${pending.length === 1 ? "issue is" : "issues are"} waiting for your rating. It takes a few seconds.`}
      />
      <ul className="mt-3 divide-y divide-border border-t border-border">
        {pending.slice(0, 3).map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <p className="truncate text-sm text-fg">{i.title}</p>
              {i.resolvedAt && <p className="text-xs text-fg-subtle">Resolved {formatRelative(i.resolvedAt)}</p>}
            </div>
            <Link href={`/issues/${i.id}#feedback`} className={buttonClasses("secondary", "sm")} aria-label={`Rate the fix for “${i.title}”`}>
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              Rate the fix
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
