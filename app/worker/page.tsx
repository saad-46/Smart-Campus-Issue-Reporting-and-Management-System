"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueCard from "@/components/IssueCard";
import BillSubmissionModal from "@/components/BillSubmissionModal";
import { Issue, IssueStatus, Transaction } from "@/types";
import { subscribeToAllIssues, updateIssueStatus, assignIssue, submitBill } from "@/lib/firestore";
import { subscribeToTransactions } from "@/lib/finance";
import { getSuggestedSolution } from "@/services/aiAssistService";

function WorkerIssueCard({ issue, workerId }: { issue: Issue, workerId: string }) {
  const [suggestion, setSuggestion] = useState<string>("");
  const [loadingSuggestion, setLoadingSuggestion] = useState<boolean>(false);
  const [showBillModal, setShowBillModal] = useState(false);

  useEffect(() => {
    const fetchSuggestion = async () => {
      setLoadingSuggestion(true);
      try {
        const text = await getSuggestedSolution(issue);
        setSuggestion(text);
      } catch (e) {
        console.error("Failed to load AI suggestion");
      }
      setLoadingSuggestion(false);
    };

    if (issue.assignedTo === workerId && issue.status !== "Resolved") {
      fetchSuggestion();
    }
  }, [issue, workerId]);

  const handleStatusChange = async (newStatus: IssueStatus) => {
    if (newStatus === "Resolved") {
      setShowBillModal(true);
      return;
    }
    try {
      await updateIssueStatus(issue.id, newStatus);
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const handleBillSuccess = async (data: { amount: number; description: string; receiptUrl: string }) => {
    try {
      await submitBill(issue.id, data.amount, data.receiptUrl);
      setShowBillModal(false);
    } catch (e) {
      console.error("Failed to submit bill", e);
      throw e;
    }
  };

  const handleSkipBill = async () => {
    try {
      await updateIssueStatus(issue.id, "Resolved");
      setShowBillModal(false);
    } catch (e) {
      console.error("Failed to resolve issue", e);
    }
  };

  const handleTakeTask = async () => {
    try {
      await assignIssue(issue.id, workerId);
    } catch (e) {
      console.error("Failed to take task", e);
    }
  };

  return (
    <div className="relative glass rounded-[32px] overflow-hidden border border-white/10 flex flex-col group transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 h-full">
      <div className="p-1">
        <IssueCard issue={issue} showActions={false} viewContext="my-issues" />
      </div>

      {issue.status === "Resolved" && (
        <div className="mx-5 mb-5 p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Resolution Details</p>
            <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">Issue successfully resolved</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Payout</p>
            <p className="text-sm font-black text-emerald-500">
              {issue.claimAmount ? `₹${issue.claimAmount.toLocaleString()}` : "No claim"}
            </p>
          </div>
        </div>
      )}

      {issue.assignedTo === workerId && issue.status !== "Resolved" && (
        <div className="mx-5 mb-5 p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 relative overflow-hidden group/ai">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full -mr-12 -mt-12 transition-all group-hover/ai:bg-indigo-500/20" />
          <p className="text-xs font-black text-indigo-400 flex items-center gap-2 mb-3 tracking-wider uppercase">
            <span className="text-base">🪄</span> AI Helper Insight
          </p>
          {loadingSuggestion ? (
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-white/5 rounded-full w-full animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-white/5 rounded-full w-4/5 animate-pulse" />
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium transition-colors group-hover/ai:text-gray-900 dark:group-hover/ai:text-white">{suggestion}</p>
          )}
        </div>
      )}

      {/* Worker Action Buttons */}
      <div className="mt-auto p-5 pt-0">
        {!issue.assignedTo && (
          <button
            onClick={handleTakeTask}
            className="w-full py-3.5 rounded-2xl text-sm font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-slate-950/20"
          >
            Claim Task →
          </button>
        )}

        {issue.assignedTo === workerId && issue.status !== "Resolved" && (
          <div className="flex items-center gap-3">
            {issue.status === "Open" && (
              <button
                onClick={() => handleStatusChange("In Progress")}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-indigo-500/20"
              >
                🏁 Start Working
              </button>
            )}
            {issue.status === "In Progress" && (
              <button
                onClick={() => handleStatusChange("Resolved")}
                className="flex-1 py-3.5 rounded-2xl text-sm font-black bg-emerald-600 text-white hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
              >
                🏆 Mark Resolved
              </button>
            )}
          </div>
        )}
      </div>

      {showBillModal && (
        <BillSubmissionModal
          issueId={issue.id}
          onSuccess={handleBillSuccess}
          onCancel={() => setShowBillModal(false)}
          onSkip={handleSkipBill}
        />
      )}
    </div>
  );
}

type FilterTab = "open-pool" | "my-active" | "resolved";

function WorkerContent() {
  const { userProfile } = useAuthContext();
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("my-active");

  useEffect(() => {
    const unsubIssues = subscribeToAllIssues((data) => {
      setAllIssues(data);
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

  const stats = useMemo(() => {
    const myIssues = allIssues.filter(i => i.assignedTo === userProfile?.id);
    const resolved = myIssues.filter(i => i.status === "Resolved");
    const pendingPaymentCount = resolved.filter(i => i.claimStatus === "pending").length;
    
    const pendingAmount = resolved
      .filter(i => i.claimStatus === "pending")
      .reduce((sum, i) => sum + (i.claimAmount || 0), 0);
      
    const availablePool = allIssues.filter(i => !i.assignedTo && i.status !== "Resolved").length;

    return {
      pendingAmount,
      pendingPaymentCount,
      resolvedTotal: resolved.length,
      availablePool
    };
  }, [allIssues, userProfile?.id]);

  const filteredIssues = useMemo(() => {
    switch (filter) {
      case "open-pool":
        return allIssues.filter(i => !i.assignedTo && i.status !== "Resolved");
      case "my-active":
        return allIssues.filter(i => i.assignedTo === userProfile?.id && i.status !== "Resolved");
      case "resolved":
        return allIssues.filter(i => i.assignedTo === userProfile?.id && i.status === "Resolved");
      default:
        return [];
    }
  }, [allIssues, filter, userProfile?.id]);

  const kpis = [
    { 
      label: "Total Money to be Received", 
      value: `₹${stats.pendingAmount.toLocaleString()}`, 
      sub: `${stats.pendingPaymentCount} tasks pending check`,
      color: "from-emerald-500 to-teal-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      label: "Total Issues Resolved", 
      value: stats.resolvedTotal.toString(), 
      sub: "Completed assignments",
      color: "from-blue-500 to-indigo-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    { 
      label: "Total Issues Available", 
      value: stats.availablePool.toString(), 
      sub: "In the campus pool",
      color: "from-purple-500 to-pink-600",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-in fade-in duration-700">
      
      {/* Header section with welcome */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-[40px] border border-white/5 relative overflow-hidden group shadow-2xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[100px] -mr-32 -mt-32 group-hover:bg-indigo-500/20 transition-all duration-1000" />
         <div className="relative z-10">
           <div className="flex items-center gap-3 mb-3">
             <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">Verified Worker</span>
             <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
           </div>
           <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">Worker Dashboard</h1>
           <p className="text-gray-400 mt-2 font-medium max-w-md leading-relaxed">Welcome back, <span className="text-white font-black">{userProfile?.name}</span>. You help keep the campus running smoothly. Track your tasks and earnings below.</p>
         </div>
         <div className="relative z-10 flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Lifetime Earnings</p>
              <h4 className="text-2xl font-black text-white">₹{transactions.reduce((s,t)=>s+t.amount,0).toLocaleString()}</h4>
            </div>
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-500">
              <span className="text-2xl">👷</span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Feed */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {kpis.map((k, i) => (
              <div 
                key={i} 
                className="group relative overflow-hidden glass rounded-[32px] p-6 border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1"
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${k.color} opacity-10 blur-3xl -mr-10 -mt-10 group-hover:opacity-20 transition-opacity`} />
                <div className="relative flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{k.label}</p>
                    <h3 className="text-3xl font-black text-white">{k.value}</h3>
                    <p className="text-xs text-gray-400 mt-2 font-medium">{k.sub}</p>
                  </div>
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${k.color} text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform`}>
                    {k.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex p-1.5 bg-gray-100 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 w-fit backdrop-blur-md">
              {(["open-pool", "my-active", "resolved"] as FilterTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    filter === t
                      ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xl shadow-indigo-500/10 scale-105"
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  {t === "open-pool" ? "🌍 Open Pool" : t === "my-active" ? "📋 My Active" : "✅ Resolved Tasks"}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-500/20" />
              <p className="text-sm font-bold text-gray-500 animate-pulse uppercase tracking-tighter">Syncing tasks from cloud...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-24 glass rounded-[40px] border-2 border-dashed border-gray-200 dark:border-white/10 max-w-2xl mx-auto">
              <div className="w-24 h-24 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner ring-8 ring-indigo-500/5">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Nothing in the queue</h3>
              <p className="text-sm text-gray-500 font-medium max-w-xs mx-auto">
                {filter === "open-pool" ? "The campus is looking great! Check back later for new reports." : 
                 filter === "my-active" ? "You don't have any active tasks. Visit the Open Pool to take some!" :
                 "You haven't resolved any tasks yet. Resolve assignments to see them here."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {filteredIssues.map(issue => (
                <WorkerIssueCard key={issue.id} issue={issue} workerId={userProfile!.id} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar: Payment History */}
        <div className="lg:col-span-1">
          <div className="glass rounded-[32px] overflow-hidden border border-white/10 shadow-xl flex flex-col h-[700px] sticky top-24">
             <div className="p-6 bg-gradient-to-br from-indigo-600/10 to-purple-600/10 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Payout History</h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">Approved Transactions</p>
                </div>
                <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
             </div>
             <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-4">
               {transactions.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30">
                    <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                    <p className="text-xs font-bold uppercase">No records found yet</p>
                 </div>
               ) : (
                 transactions.map(tx => (
                   <div key={tx.id} className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-indigo-500/30 hover:bg-white/[0.08] transition-all duration-300">
                     <div className="flex items-center justify-between mb-3">
                       <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${tx.type === 'receipt' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                         {tx.type === 'receipt' ? 'Repair Claim' : 'Bonus'}
                       </span>
                       <span className="text-xs font-bold text-gray-500">{tx.createdAt.toLocaleDateString()}</span>
                     </div>
                     <p className="text-sm font-bold text-gray-900 dark:text-gray-200 line-clamp-1 group-hover:line-clamp-none transition-all">{tx.note || "System Payout"}</p>
                     <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                       <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Verified Status</span>
                       <span className="text-lg font-black text-emerald-400">+₹{tx.amount.toLocaleString()}</span>
                     </div>
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

export default function WorkerDashboardPage() {
  return (
    <ProtectedRoute requiredRole="worker">
      <WorkerContent />
    </ProtectedRoute>
  );
}
