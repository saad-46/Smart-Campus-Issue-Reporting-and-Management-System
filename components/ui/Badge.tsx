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
  High: "bg-red-500/10 text-red-500 border-red-500/20",
  Medium: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  Low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const statusStyles: Record<IssueStatus, string> = {
  Open: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  "In Progress": "bg-purple-500/10 text-purple-500 border-purple-500/20",
  Resolved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
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
        px-3 py-1 text-[10px] font-black uppercase tracking-widest
        rounded-full border shadow-sm
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
