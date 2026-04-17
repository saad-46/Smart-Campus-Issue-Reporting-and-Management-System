"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import IssueCard from "@/components/IssueCard";
import { Issue, IssueStatus, Transaction } from "@/types";
import { subscribeToAllIssues, updateIssueStatus, assignIssue } from "@/lib/firestore";
import { subscribeToTransactions } from "@/lib/finance";

const STATUS_ORDER: Record<string, number> = { "In Progress": 0, "Open": 1, "Resolved": 2 };

export default function WorkerDashboard() {
  const { userProfile } = useAuthContext();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "mine" | "open">("open");

  useEffect(() => {
    const unsubIssues = subscribeToAllIssues((data) => {
      setIssues(data);
      setLoading(false);
    });
    
    let unsubTx: () => void;
    if (userProfile?.id) {
      unsubTx = subscribeToTransactions(userProfile.id, setTransactions);
    }
    
    return () => {
      unsubIssues();
      if (unsubTx) unsubTx();
    };
  }, [userProfile?.id]);

  const filtered = useMemo(() => {
    let list = issues.filter((i) => i.status !== "Resolved");
    if (filter === "mine") list = list.filter((i) => i.assignedTo === userProfile?.id);
    if (filter === "open") list = list.filter((i) => i.status === "Open");
    return list.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
  }, [issues, filter, userProfile]);

  const myTasks = issues.filter((i) => i.assignedTo === userProfile?.id && i.status !== "Resolved");
  const resolved = issues.filter((i) => i.assignedTo === userProfile?.id && i.status === "Resolved");

  const totalEarnings = useMemo(() => {
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

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
          Welcome back, <span className="font-semibold">{userProfile?.name}</span> — manage your assignments & earnings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Earnings KPI */}
        <div className="lg:col-span-1 glass rounded-2xl p-6 border border-emerald-500/20 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-800/40 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 hover:scale-105 transition origin-left"><span className="p-1 rounded bg-emerald-500/20">💰</span> Total Earnings</p>
            <h3 className="text-4xl font-black text-gray-900 dark:text-white mt-4">₹{totalEarnings.toLocaleString()}</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-right flex items-center justify-end gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Balance Updates</p>
        </div>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-3 gap-4">
          <div className="glass rounded-2xl p-5 border border-purple-500/20 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-800/40 shadow-sm flex flex-col justify-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{myTasks.length}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mt-1">Active Tasks</p>
          </div>
          <div className="glass rounded-2xl p-5 border border-blue-500/20 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-slate-800/40 shadow-sm flex flex-col justify-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{issues.filter((i) => i.status === "Open").length}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">Open Pool</p>
          </div>
          <div className="glass rounded-2xl p-5 border border-indigo-500/20 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/20 dark:to-slate-800/40 shadow-sm flex flex-col justify-center">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{resolved.length}</p>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-1">Resolved Targets</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Filter tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl mb-6 w-fit">
            {(["open", "mine", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 text-sm font-medium transition-all duration-200 capitalize rounded-lg ${
                  filter === f
                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-white/10"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border-transparent border"
                }`}
              >
                {f === "open" ? "🔓 Open Issues" : f === "mine" ? "👤 My Tasks" : "📋 All Active"}
              </button>
            ))}
          </div>

          {/* Issues */}
          {loading ? (
            <div className="flex flex-col items-center gap-4 py-20">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Syncing active queue…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 glass rounded-2xl border border-gray-200 dark:border-white/10">
              <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🌴</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Queue Empty</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">All tasks cleared out. Relax!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
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

        {/* Transaction History Column */}
        <div className="lg:col-span-1">
          <div className="glass rounded-2xl flex flex-col border border-gray-200 dark:border-white/10 shadow-lg overflow-hidden h-[500px]">
             <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 shrink-0">
               <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                 <span className="p-1 rounded bg-emerald-500/20 text-emerald-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
                 Payment History
               </h3>
             </div>
             <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 dark:bg-black/10 space-y-3">
               {transactions.length === 0 ? (
                 <div className="h-full flex items-center justify-center text-sm text-gray-400 text-center">
                   No transaction history yet.
                 </div>
               ) : (
                 transactions.map(tx => (
                   <div key={tx.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 shadow-sm flex items-center justify-between hover:border-emerald-500/30 transition">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">₹</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[150px]">{tx.note || "Bonus Payment"}</p>
                          <p className="text-[10px] text-gray-500">{tx.createdAt.toLocaleDateString()}</p>
                        </div>
                     </div>
                     <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">+₹{tx.amount}</span>
                   </div>
                 ))
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
