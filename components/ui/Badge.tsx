// ============================================
// Badge — Priority & Status Badge Component
// ============================================
// Color-coded badges for displaying priority and status.

"use client";

import React from "react";
import { Priority, IssueStatus } from "@/types";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "priority" | "status";
  priority?: Priority;
  status?: IssueStatus;
  className?: string;
}

const priorityStyles: Record<Priority, string> = {
  High: "bg-red-500/20 text-red-400 border-red-500/30",
  Medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  Low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const statusStyles: Record<IssueStatus, string> = {
  Open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "In Progress": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Resolved: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export default function Badge({
  children,
  variant = "default",
  priority,
  status,
  className = "",
}: BadgeProps) {
  let colorClasses = "bg-gray-700/50 text-gray-300 border-gray-600/50";

  if (variant === "priority" && priority) {
    colorClasses = priorityStyles[priority];
  } else if (variant === "status" && status) {
    colorClasses = statusStyles[status];
  }

  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-1 text-xs font-medium
        rounded-lg border
        ${colorClasses}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

/** Convenience component for priority badges */
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge variant="priority" priority={priority}>
      {priority === "High" && "🔴 "}
      {priority === "Medium" && "🟡 "}
      {priority === "Low" && "🟢 "}
      {priority}
    </Badge>
  );
}

/** Convenience component for status badges */
export function StatusBadge({ status }: { status: IssueStatus }) {
  return (
    <Badge variant="status" status={status}>
      {status}
    </Badge>
  );
}
