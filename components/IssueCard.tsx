// ============================================
// IssueCard — Card displaying issue details
// ============================================
// Used in both user and admin dashboards.

"use client";

import React from "react";
import { Issue } from "@/types";
import Card from "@/components/ui/Card";
import { PriorityBadge, StatusBadge } from "@/components/ui/Badge";

interface IssueCardProps {
  issue: Issue;
  showActions?: boolean;
  onStatusChange?: (issueId: string, status: Issue["status"]) => void;
  onAssign?: (issueId: string) => void;
}

export default function IssueCard({
  issue,
  showActions = false,
  onStatusChange,
  onAssign,
}: IssueCardProps) {
  const priorityBorderColor = {
    High: "border-l-red-500",
    Medium: "border-l-amber-500",
    Low: "border-l-emerald-500",
  };

  return (
    <Card
      className={`border-l-4 ${priorityBorderColor[issue.priority]} !rounded-l-lg`}
      hover
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className="text-base font-semibold text-white leading-tight">
          {issue.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <PriorityBadge priority={issue.priority} />
          <StatusBadge status={issue.status} />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
        {issue.description}
      </p>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {issue.location}
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          {issue.category}
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {issue.createdByName}
        </span>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {issue.createdAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Admin Actions */}
      {showActions && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-800">
          {issue.status !== "Resolved" && (
            <>
              {issue.status === "Open" && (
                <button
                  onClick={() => onAssign?.(issue.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-lg hover:bg-indigo-500/30 transition-colors"
                >
                  Assign to Me
                </button>
              )}
              {issue.status === "Open" && (
                <button
                  onClick={() => onStatusChange?.(issue.id, "In Progress")}
                  className="px-3 py-1.5 text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/30 transition-colors"
                >
                  Mark In Progress
                </button>
              )}
              {issue.status === "In Progress" && (
                <button
                  onClick={() => onStatusChange?.(issue.id, "Resolved")}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition-colors"
                >
                  Mark Resolved
                </button>
              )}
            </>
          )}
          {issue.assignedTo && (
            <span className="text-xs text-gray-500 ml-auto">
              Assigned ✓
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
