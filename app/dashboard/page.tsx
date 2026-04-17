"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAuthContext } from "@/components/AuthProvider";
import { useSearchParams } from "next/navigation";
import IssueCard from "@/components/IssueCard";
import ChatReporter from "@/components/ChatReporter";
import IssueForm from "@/components/IssueForm";
import Button from "@/components/ui/Button";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Issue } from "@/types";
import { subscribeToUserIssues, subscribeToAllIssues } from "@/lib/firestore";

const STATUS_ORDER: Record<string, number> = { "In Progress": 0, "Open": 1, "Resolved": 2 };
const CATEGORIES = ["All", "Infrastructure", "Electrical", "Cleanliness", "Safety", "Technology", "Others"];

type Tab = "my-issues" | "explore" | "report";

function DashboardContent() {
  const { userProfile } = useAuthContext();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "my-issues";

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [globalIssues, setGlobalIssues] = useState<Issue[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");
  const [reportMode, setReportMode] = useState<"chat" | "form">("chat");

  // Sync tab state if URL changes (e.g. clicking sidebar while already on dashboard)
  useEffect(() => {
    const t = searchParams.get("tab") as Tab;
    if (t && (t === "my-issues" || t === "explore" || t === "report")) {
      setTab(t);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!userProfile?.id) return;
    let active = true;
    const unsubUser = subscribeToUserIssues(userProfile.id, (data) => {
      if (active) {
        setIssues(data);
        if (tab === "my-issues") setLoading(false);
      }
    });
    const unsubGlobal = subscribeToAllIssues((data) => {
      if (active) {
        setGlobalIssues(data);
        if (tab === "explore") setLoading(false);
      }
    });

    return () => {
      active = false;
      unsubUser();
      unsubGlobal();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id, tab]);

  const currentData = tab === "my-issues" ? issues : globalIssues;

  const filteredIssues = useMemo(() => {
    let base = currentData.filter((i) => {
      const cat = categoryFilter === "All" || i.category.toLowerCase() === categoryFilter.toLowerCase();
      const st = statusFilter === "all" || i.status === statusFilter;
      return cat && st;
    });

    if (tab === "explore") {
      base = base.sort((a, b) => b.upvotes - a.upvotes);
    } else {
      base = base.sort((a, b) => {
        const d = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        return d !== 0 ? d : b.createdAt.getTime() - a.createdAt.getTime();
      });
    }
    return base;
  }, [currentData, categoryFilter, statusFilter, tab]);

  const openCount = currentData.filter((i) => i.status === "Open").length;
  const inProgressCount = currentData.filter((i) => i.status === "In Progress").length;
  const resolvedCount = currentData.filter((i) => i.status === "Resolved").length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {tab === "report" ? "Report an Issue" : "Campus Community Hub"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {tab === "report" ? "Help build a better campus by reporting problems." : "Track your issues and explore community reports."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-8 w-fit shadow-inner">
        {(["my-issues", "explore", "report"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); if(t !== "report") setLoading(true); setTimeout(() => setLoading(false), 300); }}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300 ${
              tab === t
                ? "bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-md scale-[1.02]"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t === "my-issues" ? "📋 My Issues" : t === "explore" ? "🌍 Explore" : "✍️ Report Issue"}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {tab === "report" ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="max-w-2xl mx-auto">
             <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-6 w-fit h-10">
                <button 
                  onClick={() => setReportMode("chat")} 
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${reportMode === "chat" ? "bg-white dark:bg-slate-800 shadow text-purple-600 dark:text-purple-400" : "text-gray-500"}`}
                >
                  🤖 AI Chat
                </button>
                <button 
                  onClick={() => setReportMode("form")} 
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${reportMode === "form" ? "bg-white dark:bg-slate-800 shadow text-purple-600 dark:text-purple-400" : "text-gray-500"}`}
                >
                  📝 Manual Form
                </button>
             </div>
             <div className="glass p-6 sm:p-8">
               {reportMode === "chat" ? <ChatReporter onIssueCreated={() => setTab("my-issues")} /> : <IssueForm />}
             </div>
           </div>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { label: "Open Issues", count: openCount, color: "text-blue-500", filter: "Open", shadow: "shadow-blue-500/20", bg: "bg-blue-500/5", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg> },
              { label: "Researching", count: inProgressCount, color: "text-indigo-500", filter: "In Progress", shadow: "shadow-indigo-500/20", bg: "bg-indigo-500/5", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
              { label: "Resolved", count: resolvedCount, color: "text-emerald-500", filter: "Resolved", shadow: "shadow-emerald-500/20", bg: "bg-emerald-500/5", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg> },
            ].map(({ label, count, color, filter, shadow, bg, icon }) => (
              <button
                key={label}
                onClick={() => setStatusFilter(statusFilter === filter ? "all" : filter)}
                className={`group relative p-8 rounded-[32px] bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 transition-all duration-300 hover:scale-[1.05] hover:shadow-2xl ${shadow} ${statusFilter === filter ? `ring-4 ring-indigo-500/20` : ""}`}
              >
                <div className={`w-12 h-12 rounded-2xl ${bg} ${color} flex items-center justify-center mb-6 transition-transform group-hover:rotate-12`}>
                  {icon}
                </div>
                <p className={`text-4xl font-black ${color} tracking-tighter`}>{count}</p>
                <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 mt-2 uppercase tracking-widest">{label}</p>
              </button>
            ))}
          </div>

          {/* Category tabs */}
          {currentData.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 ${
                    categoryFilter === cat
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30 scale-105"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  }`}
                >
                  {cat}
                </button>
              ))}
              {(categoryFilter !== "All" || statusFilter !== "all") && (
                <button
                  onClick={() => { setCategoryFilter("All"); setStatusFilter("all"); }}
                  className="px-4 py-2 rounded-full text-xs font-bold text-red-500 bg-red-500/5 hover:bg-red-500/10 transition-all"
                >
                  Clear Filters ✕
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center gap-4 py-24">
              <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Loading resources…</p>
            </div>
          ) : currentData.length === 0 ? (
            <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-3xl border-2 border-dashed border-gray-200 dark:border-white/10">
              <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                <svg className="w-10 h-10 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No data recorded</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">Start help build a safer campus environment by reporting the first issue.</p>
              <button 
                onClick={() => setTab("report")} 
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-black rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-purple-500/20 flex items-center gap-2 mx-auto active:scale-95"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4"/></svg>
                Report a Problem Now
              </button>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-16 bg-gray-50/50 dark:bg-white/5 rounded-3xl">
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-4">No issues match the selected criteria</p>
              <button onClick={() => { setCategoryFilter("All"); setStatusFilter("all"); }} className="text-sm font-bold text-purple-600 dark:text-purple-400 h-10 px-6 rounded-xl border border-purple-500/20 hover:bg-purple-500/5 transition-all">
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Showing {filteredIssues.length} of {currentData.length} entries
                </p>
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                  Sorted by {tab === "explore" ? "Popularity" : "Status"}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {filteredIssues.map((issue) => (
                   <IssueCard key={issue.id} issue={issue} viewContext={tab} />
                 ))}
              </div>
            </div>
          )}
        </div>
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
