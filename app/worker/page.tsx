"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import IssueCard from "@/components/IssueCard";
import { Issue, IssueStatus } from "@/types";
import { subscribeToAllIssues, updateIssueStatus, assignIssue } from "@/lib/firestore";

const STATUS_ORDER: Record<string, number> = { "In Progress": 0, "Open": 1, "Resolved": 2 };

export default function WorkerDashboard() {
  const { userProfile } = useAuthContext();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine" | "open">("open");

  useEffect(() => {
    const unsub = subscribeToAllIssues((data) => {
      setIssues(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let list = issues.filter((i) => i.status !== "Resolved");
    if (filter === "mine") list = list.filter((i) => i.assignedTo === userProfile?.id);
    if (filter === "open") list = list.filter((i) => i.status === "Open");
    return list.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [issues, filter, userProfile]);

  const myTasks = issues.filter((i) => i.assignedTo === userProfile?.id && i.status !== "Resolved");
  const resolved = issues.filter((i) => i.assignedTo === userProfile?.id && i.status === "Resolved");

  const handleStatusChange = async (id: string, status: IssueStatus) => {
    try { await updateIssueStatus(id, status); } catch (e) { console.error(e); }
  };

  const handleAssign = async (id: string) => {
    if (!userProfile) return;
    try { await assignIssue(id, userProfile.id); } catch (e) { console.error(e); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Worker Dashboard
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Welcome back, {userProfile?.name} — manage your assigned tasks
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <p className="text-2xl font-bold text-purple-500">{myTasks.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">My Active Tasks</p>
        </div>
        <div className="stat-card">
          <p className="text-2xl font-bold text-blue-500">
            {issues.filter((i) => i.status === "Open").length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Open Issues</p>
        </div>
        <div className="stat-card">
          <p className="text-2xl font-bold text-emerald-500">{resolved.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Resolved by Me</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-6 w-fit">
        {(["open", "mine", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize ${
              filter === f
                ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {f === "open" ? "🔓 Open Issues" : f === "mine" ? "👤 My Tasks" : "📋 All Active"}
          </button>
        ))}
      </div>

      {/* Issues */}
      {loading ? (
        <div className="flex flex-col items-center gap-4 py-20">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading tasks…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All clear!</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">No issues in this view</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              showActions
              onStatusChange={handleStatusChange}
              onAssign={handleAssign}
            />
          ))}
        </div>
      )}
    </div>
  );
}
