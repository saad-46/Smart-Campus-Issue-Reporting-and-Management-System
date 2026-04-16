"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueCard from "@/components/IssueCard";
import ChatReporter from "@/components/ChatReporter";
import Button from "@/components/ui/Button";
import { Issue } from "@/types";
import { subscribeToUserIssues } from "@/lib/firestore";

const STATUS_ORDER: Record<string, number> = { "In Progress": 0, "Open": 1, "Resolved": 2 };
const CATEGORIES = ["All", "Infrastructure", "Electrical", "Cleanliness", "Safety", "Technology", "Others"];

type Tab = "issues" | "chat";

function DashboardContent() {
  const { userProfile } = useAuthContext();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("issues");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!userProfile) return;
    const unsub = subscribeToUserIssues(userProfile.id, (data) => {
      setIssues(data);
      setLoading(false);
    });
    return () => unsub();
  }, [userProfile]);

  const filteredIssues = useMemo(() => {
    return issues
      .filter((i) => {
        const cat = categoryFilter === "All" || i.category.toLowerCase() === categoryFilter.toLowerCase();
        const st = statusFilter === "all" || i.status === statusFilter;
        return cat && st;
      })
      .sort((a, b) => {
        const d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        return d !== 0 ? d : b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [issues, categoryFilter, statusFilter]);

  const openCount = issues.filter((i) => i.status === "Open").length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved").length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Issues</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track and report campus issues</p>
        </div>
        <Link href="/dashboard/report">
          <Button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Report via Form
          </Button>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-6 w-fit">
        {(["issues", "chat"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t
                ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t === "issues" ? "📋 My Issues" : "🤖 AI Reporter"}
          </button>
        ))}
      </div>

      {tab === "chat" ? (
        <div className="max-w-2xl">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Describe your issue in plain English — our AI will extract the details and submit it for you.
          </p>
          <ChatReporter onIssueCreated={() => setTab("issues")} />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Open", count: openCount, color: "text-blue-500", filter: "Open", ring: "ring-blue-500/40" },
              { label: "In Progress", count: inProgressCount, color: "text-purple-500", filter: "In Progress", ring: "ring-purple-500/40" },
              { label: "Resolved", count: resolvedCount, color: "text-emerald-500", filter: "Resolved", ring: "ring-emerald-500/40" },
            ].map(({ label, count, color, filter, ring }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(statusFilter === filter ? "all" : filter)}
                className={`stat-card text-left transition-all duration-200 hover:scale-[1.02] ${statusFilter === filter ? `ring-2 ${ring}` : ""}`}
              >
                <p className={`text-2xl font-bold ${color}`}>{count}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
              </button>
            ))}
          </div>

          {/* Category tabs */}
          {issues.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    categoryFilter === cat
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                      : "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20"
                  }`}
                >
                  {cat}
                </button>
              ))}
              {(categoryFilter !== "All" || statusFilter !== "all") && (
                <button
                  onClick={() => { setCategoryFilter("All"); setStatusFilter("all"); }}
                  className="px-3 py-1.5 rounded-full text-xs font-medium text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-all"
                >
                  Clear ✕
                </button>
              )}
            </div>
          )}

          {/* Issues list */}
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading your issues…</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No issues yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Use the AI Reporter tab or the form to get started</p>
              <button onClick={() => setTab("chat")} className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity">
                Try AI Reporter 🤖
              </button>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-3">No issues match your filters</p>
              <button onClick={() => { setCategoryFilter("All"); setStatusFilter("all"); }} className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {filteredIssues.length} of {issues.length} issues · sorted by status
              </p>
              {filteredIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
