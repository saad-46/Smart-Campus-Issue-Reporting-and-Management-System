"use client";

import React, { useState } from "react";
import { Issue } from "@/types";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import UpvoteButton from "@/components/ui/UpvoteButton";
import ImageModal from "./ImageModal";
import Link from "next/link";

interface IssueCardProps {
  issue: Issue;
  showActions?: boolean;
  viewContext?: "my-issues" | "explore";
  onStatusChange?: (issueId: string, status: Issue["status"]) => void;
  onAssign?: (issueId: string) => void;
}

const priorityBorder: Record<string, string> = {
  High: "border-l-red-500",
  Medium: "border-l-amber-500",
  Low: "border-l-emerald-500",
};

export default function IssueCard({ issue, showActions = false, viewContext = "my-issues", onStatusChange, onAssign }: IssueCardProps) {
  const [showImageModal, setShowImageModal] = useState(false);

  return (
    <>
      <div className={`
        glass relative group overflow-hidden
        border-l-4 ${priorityBorder[issue.priority]}
        border-t border-r border-b border-gray-800/60
        rounded-2xl p-5 
        hover:scale-105 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/10
        transition-all duration-300 ease-out flex flex-col h-full
      `}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight flex-1">
            {issue.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
            {issue.escalated && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full animate-pulse">
                🔺 Escalated
              </span>
            )}
          </div>
        </div>

        {/* Upvote + trending */}
        {viewContext === "explore" && (
          <div className="mb-3 flex items-center justify-between">
            <UpvoteButton
              issueId={issue.id}
              upvotes={issue.upvotes ?? 0}
              upvotedBy={issue.upvotedBy ?? []}
            />
          </div>
        )}

        {/* Images Preview */}
        {(issue.imageUrls?.length ? issue.imageUrls : issue.imageUrl ? [issue.imageUrl] : []).length > 0 && (
          <div className="mb-3">
            <div className={`grid gap-2 ${issue.imageUrls && issue.imageUrls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {(issue.imageUrls?.length ? issue.imageUrls : [issue.imageUrl as string]).slice(0, 2).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={issue.title}
                  className="w-full h-44 object-cover rounded-xl border border-gray-200 dark:border-white/10 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setShowImageModal(true)}
                />
              ))}
            </div>
            {issue.imageUrls && issue.imageUrls.length > 2 && (
              <p className="text-xs text-gray-400 mt-2 text-center">+{issue.imageUrls.length - 2} more image(s)</p>
            )}
            <p className="text-[10px] text-gray-500 mt-1 text-center">Click to enlarge</p>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
          {issue.description}
        </p>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 dark:text-gray-500 mb-4">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {issue.location}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {issue.category}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {issue.createdByName}
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {issue.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>

        {/* Admin actions */}
        {showActions && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100 dark:border-white/10">
            {issue.status !== "Resolved" && (
              <>
                {onAssign && issue.status === "Open" && !issue.assignedTo && (
                  <button
                    onClick={() => onAssign(issue.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
                  >
                    Assign to Me
                  </button>
                )}
                {onStatusChange && issue.status === "Open" && (
                  <button
                    onClick={() => onStatusChange(issue.id, "In Progress")}
                    className="px-3 py-1.5 text-xs font-medium bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/30 transition-colors"
                  >
                    Mark In Progress
                  </button>
                )}
                {onStatusChange && issue.status === "In Progress" && (
                  <button
                    onClick={() => onStatusChange(issue.id, "Resolved")}
                    className="px-3 py-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-500/30 transition-colors"
                  >
                    Mark Resolved
                  </button>
                )}
              </>
            )}
            {issue.assignedTo && (
              <span className="text-xs text-gray-400 ml-auto">Assigned ✓</span>
            )}
          </div>
        )}

        {/* Global Details Forwarder */}
        <div className="mt-4 pt-4 border-t border-gray-800/40">
          <Link href={`/issues/${issue.id}`} className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white transition-all shadow-lg shadow-purple-500/20">
            View Issue Details & Chat
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </Link>
        </div>
      </div>

      {showImageModal && issue.imageUrl && (
        <ImageModal imageUrl={issue.imageUrl} alt={issue.title} onClose={() => setShowImageModal(false)} />
      )}
    </>
  );
}
