"use client";

import React, { useState } from "react";
import { toggleUpvote } from "@/lib/firestore";
import { useAuthContext } from "@/components/AuthProvider";

interface UpvoteButtonProps {
  issueId: string;
  upvotes: number;
  upvotedBy?: string[];
}

export default function UpvoteButton({ issueId, upvotes, upvotedBy = [] }: UpvoteButtonProps) {
  const { userProfile } = useAuthContext();
  const userId = userProfile?.id ?? "";
  const [optimisticCount, setOptimisticCount] = useState(upvotes);
  const [optimisticVoted, setOptimisticVoted] = useState(upvotedBy.includes(userId));
  const [loading, setLoading] = useState(false);

  const handleUpvote = async () => {
    if (!userId || loading) return;
    setLoading(true);
    // Optimistic update
    const next = !optimisticVoted;
    setOptimisticVoted(next);
    setOptimisticCount((c) => (next ? c + 1 : Math.max(0, c - 1)));
    try {
      await toggleUpvote(issueId, userId);
    } catch {
      // Revert on failure
      setOptimisticVoted(!next);
      setOptimisticCount((c) => (next ? Math.max(0, c - 1) : c + 1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpvote}
      disabled={!userId || loading}
      title={userId ? (optimisticVoted ? "Remove upvote" : "Upvote this issue") : "Sign in to upvote"}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
        border transition-all duration-200 select-none
        ${optimisticVoted
          ? "bg-purple-500/20 border-purple-500/40 text-purple-400 hover:bg-purple-500/30"
          : "bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-purple-400 hover:text-purple-500"
        }
        disabled:opacity-40 disabled:cursor-not-allowed
      `}
    >
      <svg
        className={`w-3.5 h-3.5 transition-transform ${optimisticVoted ? "scale-110" : ""}`}
        fill={optimisticVoted ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
      </svg>
      <span>{optimisticCount}</span>
      {optimisticCount >= 5 && (
        <span className="ml-0.5 text-orange-400" title="Trending">🔥</span>
      )}
    </button>
  );
}
