"use client";

import React, { useEffect, useState } from "react";
import { ThumbsUp } from "lucide-react";
import { toggleUpvote } from "@/lib/firestore";
import { useAuthContext } from "@/components/AuthProvider";
import { logError } from "@/lib/errors";
import { cn } from "@/lib/cn";

interface UpvoteButtonProps {
  issueId: string;
  upvotes: number;
  upvotedBy?: string[];
  /** Included in the accessible name so each row's button is distinguishable. */
  issueTitle?: string;
}

/** "Me too" for community issues. Optimistic while the write is in flight. */
export default function UpvoteButton({ issueId, upvotes, upvotedBy = [], issueTitle }: UpvoteButtonProps) {
  const { userProfile } = useAuthContext();
  const userId = userProfile?.id ?? "";

  // Server state comes from props (kept fresh by the real-time listener).
  // An optimistic override is shown only while our own write is in flight,
  // so votes from other people are never masked by stale local state.
  const serverVoted = upvotedBy.includes(userId);
  const [pendingVote, setPendingVote] = useState<boolean | null>(null);

  const voted = pendingVote ?? serverVoted;
  const count =
    pendingVote === null || pendingVote === serverVoted ? upvotes : Math.max(0, upvotes + (pendingVote ? 1 : -1));

  const handleUpvote = async () => {
    if (!userId || pendingVote !== null) return;
    setPendingVote(!serverVoted);
    try {
      await toggleUpvote(issueId, userId);
    } catch (err) {
      logError("toggleUpvote", err);
      setPendingVote(null); // revert
    }
  };

  useEffect(() => {
    if (pendingVote !== null && pendingVote === serverVoted) setPendingVote(null);
  }, [pendingVote, serverVoted]);

  return (
    <button
      type="button"
      onClick={handleUpvote}
      disabled={!userId}
      aria-disabled={pendingVote !== null || undefined}
      aria-pressed={voted}
      aria-label={`This affects me too${issueTitle ? `: “${issueTitle}”` : ""} (${count} vote${count === 1 ? "" : "s"})`}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors duration-150 disabled:cursor-default",
        voted
          ? "border-brand-subtle-border bg-brand-subtle text-brand-fg"
          : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
      )}
    >
      <ThumbsUp className={cn("h-3.5 w-3.5", voted && "fill-current")} aria-hidden="true" />
      <span className="tabular">{count}</span>
      <span className="hidden sm:inline">{voted ? "Affects me" : "Me too"}</span>
    </button>
  );
}
