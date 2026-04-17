"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueCard from "@/components/IssueCard";
import BillSubmissionForm from "@/components/BillSubmissionForm";
import { Issue, IssueStatus, Transaction } from "@/types";
import { subscribeToAllIssues, updateIssueStatus, assignIssue, submitBill } from "@/lib/firestore";
import { subscribeToTransactions } from "@/lib/finance";
import { getSuggestedSolution } from "@/services/aiAssistService";

function WorkerIssueCard({ 
  issue, 
  workerId, 
  onResolveClick 
}: { 
  issue: Issue, 
  workerId: string, 
  onResolveClick?: (issue: Issue) => void 
}) {
  const [suggestion, setSuggestion] = useState<string>("");
  const [loadingSuggestion, setLoadingSuggestion] = useState<boolean>(false);

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
    if (newStatus === "Resolved" && onResolveClick) {
      onResolveClick(issue);
      return;
    }
    try {
      await updateIssueStatus(issue.id, newStatus);
    } catch (e) {
      console.error("Failed to update status", e);
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
    <div className="relative bg-white dark:bg-slate-900 rounded-[24px] overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col group transition-all duration-300 hover:shadow-xl hover:border-indigo-500/30">
      <div className="p-1">
        <IssueCard issue={issue} showActions={false} viewContext="my-issues" />
      </div>

      {issue.assignedTo === workerId && issue.status !== "Resolved" && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/10 relative overflow-hidden">
          <p className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 flex items-center gap-2 mb-2 uppercase tracking-wider">
            🪄 AI Insight
          </p>
          {loadingSuggestion ? (
            <div className="space-y-1.5">
              <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full w-full animate-pulse" />
              <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full w-4/5 animate-pulse" />
            </div>
          ) : (
            <p className="text-xs text-slate-700 dark:text-gray-300 leading-relaxed font-semibold">{suggestion}</p>
          )}
        </div>
      )}

      {/* Worker Action Buttons */}
      <div className="mt-auto p-4 pt-0">
        {!issue.assignedTo && (
          <button
            onClick={handleTakeTask}
            className="w-full py-3 rounded-xl text-xs font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-all uppercase tracking-widest shadow-lg shadow-slate-950/20"
          >
            Claim Task →
          </button>
        )}

        {issue.assignedTo === workerId && issue.status !== "Resolved" && (
          <div className="flex items-center gap-2">
            {issue.status === "Open" && (
              <button
                onClick={() => handleStatusChange("In Progress")}
                className="flex-1 py-3 rounded-xl text-xs font-black bg-indigo-600 text-white hover:bg-indigo-700 transition-all uppercase tracking-widest"
              >
                Start
              </button>
            )}
            {issue.status === "In Progress" && (
              <button
                onClick={() => handleStatusChange("Resolved")}
                className="flex-1 py-3 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all uppercase tracking-widest"
              >
                Resolve
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type FilterTab = "work" | "submission";

function WorkerContent() {
  const { userProfile } = useAuthContext();
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<FilterTab>("work");
  const [resolvingIssue, setResolvingIssue] = useState<Issue | null>(null);

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
    const resolvedCount = myIssues.filter(i => i.status === "Resolved").length;
    
    const pendingAmount = myIssues
      .filter(i => i.status === "Resolved" && i.claimStatus === "pending")
      .reduce((sum, i) => sum + (i.claimAmount || 0), 0);
      
    const availablePool = allIssues.filter(i => !i.assignedTo && i.status === "Open").length;

    return {
      pendingAmount,
      resolvedTotal: resolvedCount,
      availablePool
    };
  }, [allIssues, userProfile?.id]);

  const poolIssues = useMemo(() => allIssues.filter(i => !i.assignedTo && i.status === "Open"), [allIssues]);
  const myActiveIssues = useMemo(() => allIssues.filter(i => i.assignedTo === userProfile?.id && i.status !== "Resolved"), [allIssues, userProfile?.id]);

  const handleResolveRequest = (issue: Issue) => {
    setResolvingIssue(issue);
    setActiveWorkspaceTab("submission");
  };

  const handleBillSuccess = async (data: { amount: number; description: string; receiptUrl: string }) => {
    if (!resolvingIssue) return;
    try {
      await submitBill(resolvingIssue.id, data.amount, data.receiptUrl);
      setResolvingIssue(null);
      setActiveWorkspaceTab("work");
    } catch (e) {
      console.error("Failed to submit bill", e);
      throw e;
    }
  };

  const handleSkipBill = async () => {
    if (!resolvingIssue) return;
    try {
      await updateIssueStatus(resolvingIssue.id, "Resolved");
      setResolvingIssue(null);
      setActiveWorkspaceTab("work");
    } catch (e) {
      console.error("Failed to resolve issue", e);
    }
  };

  const kpis = [
    { 
      label: "Pending Payout", 
      value: `₹${stats.pendingAmount.toLocaleString()}`, 
      sub: `${myActiveIssues.length} tasks matching search`,
      color: "text-emerald-500",
      bg: "bg-emerald-500/5",
      shadow: "shadow-emerald-500/20",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    },
    { 
      label: "Issues Resolved", 
      value: stats.resolvedTotal.toString(), 
      sub: stats.resolvedTotal === 0 ? "No completed tasks yet" : "Lifetime assignments",
      color: "text-indigo-500",
      bg: "bg-indigo-500/5",
      shadow: "shadow-indigo-500/20",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
    },
    { 
      label: "Available Pool", 
      value: stats.availablePool.toString(), 
      sub: stats.availablePool === 0 ? "No open issues" : "In campus pool",
      color: "text-blue-500",
      bg: "bg-blue-500/5",
      shadow: "shadow-blue-500/20",
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 bg-white dark:bg-transparent min-h-screen">
      
      {/* 1. KPI TOP ROW — 3 Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {kpis.map((k, i) => (
          <div 
            key={i} 
            className={`group relative p-8 rounded-[32px] bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 transition-all duration-300 hover:scale-[1.05] hover:shadow-2xl ${k.shadow}`}
          >
            <div className={`w-12 h-12 rounded-2xl ${k.bg} ${k.color} flex items-center justify-center mb-6 transition-transform group-hover:rotate-12`}>
              {k.icon}
            </div>
            <p className={`text-4xl font-black ${k.color} tracking-tighter`}>{k.value}</p>
            <p className="text-[10px] font-black text-slate-400 dark:text-gray-500 mt-2 uppercase tracking-widest">{k.label}</p>
            <p className="text-[10px] font-bold text-slate-300 dark:text-gray-500 mt-1 uppercase tracking-tighter opacity-60">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 2. MAIN SPLIT CONTENT — 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* LEFT COLUMN: Workspace (Tasks / Form) */}
        <div className="flex flex-col h-full max-h-[80vh]">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {activeWorkspaceTab === "work" ? "Active Workspace" : "Expense Submission"}
            </h2>
            <div className="flex bg-gray-200 dark:bg-white/5 p-1 rounded-xl border border-gray-200 dark:border-white/10 shrink-0">
               <button 
                 onClick={() => { 
                   console.log("Switching to Tasks tab");
                   setActiveWorkspaceTab("work"); 
                 }}
                 className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 transform ${activeWorkspaceTab === 'work' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-xl scale-105' : 'text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
               >
                 Tasks
               </button>
               <button 
                 onClick={() => {
                   console.log("Switching to Form tab");
                   setActiveWorkspaceTab("submission");
                 }}
                 className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 transform ${activeWorkspaceTab === 'submission' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-xl scale-105' : 'text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
               >
                 Form
               </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6 min-h-[400px] transition-all duration-500">
            {activeWorkspaceTab === "work" ? (
              <div className="space-y-8 pb-10">
                {/* Section: My Active Tasks */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                    <h4 className="text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Your Assignments ({myActiveIssues.length})</h4>
                  </div>
                  {myActiveIssues.length === 0 ? (
                    <div className="p-10 rounded-[32px] border-2 border-dashed border-gray-200 dark:border-white/5 text-center bg-gray-50/50 dark:bg-white/[0.02]">
                       <p className="text-sm font-bold text-gray-400">No active tasks. Take one from the pool below!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {myActiveIssues.map(i => (
                        <WorkerIssueCard key={i.id} issue={i} workerId={userProfile!.id} onResolveClick={handleResolveRequest} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Section: Open Pool */}
                <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <h4 className="text-[10px] font-black text-slate-500 dark:text-gray-400 uppercase tracking-widest">Available in Pool ({poolIssues.length})</h4>
                  </div>
                  {poolIssues.length === 0 ? (
                    <div className="p-10 rounded-[32px] border-2 border-dashed border-gray-200 dark:border-white/5 text-center bg-gray-50/50 dark:bg-white/[0.02]">
                       <p className="text-sm font-bold text-gray-400">All campus issues are currently assigned. Great job! No available issues</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                       {poolIssues.map(i => (
                         <WorkerIssueCard key={i.id} issue={i} workerId={userProfile!.id} />
                       ))}
                    </div>
                  )}
                </div>
              </div>
            ) : resolvingIssue ? (
              <div className="pb-10">
                 <BillSubmissionForm 
                   issueId={resolvingIssue.id}
                   issueTitle={resolvingIssue.title}
                   onSuccess={handleBillSuccess}
                   onCancel={() => { setResolvingIssue(null); setActiveWorkspaceTab("work"); }}
                   onSkip={handleSkipBill}
                 />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center glass rounded-[40px] border-2 border-dashed border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">No active resolution</h3>
                <p className="text-sm font-bold text-gray-500 max-w-xs mx-auto">Please go to the Tasks tab and click "Resolve" on an active task to start a submission.</p>
                <button 
                  onClick={() => setActiveWorkspaceTab("work")}
                  className="mt-6 px-6 py-2.5 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20"
                >
                  Go to Tasks →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Payment History */}
        <div className="flex flex-col h-full sticky top-8">
           <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 px-2">Approved Payouts</h2>
           <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-gray-200 dark:border-white/10 shadow-lg overflow-hidden flex flex-col h-[70vh]">
              <div className="p-6 bg-slate-50 dark:bg-white/[0.02] border-b border-gray-100 dark:border-white/5 flex items-center justify-between shrink-0">
                  <div>
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Verified History</p>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-tighter mt-0.5">Approved Transactions</h4>
                  </div>
                  <div className="p-3 bg-white dark:bg-white/5 rounded-2xl shadow-sm border border-gray-100 dark:border-white/10">
                     <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                 {transactions.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                      </div>
                      <p className="text-xs font-black text-slate-500 uppercase tracking-widest">No payment history yet</p>
                   </div>
                 ) : (
                   transactions.map(tx => (
                     <div key={tx.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 hover:border-indigo-500/30 transition-all group">
                       <div className="flex items-center justify-between mb-3">
                         <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white dark:bg-white/10 text-slate-500 dark:text-gray-400 uppercase border border-gray-100 dark:border-white/5 tracking-tighter">
                           {tx.type === 'receipt' ? 'Repair Claim' : 'Bonus'}
                         </span>
                         <span className="text-[10px] font-bold text-gray-400">{tx.createdAt.toLocaleDateString()}</span>
                       </div>
                       <p className="text-sm font-bold text-slate-900 dark:text-gray-100 mb-3 truncate group-hover:block transition-all">{tx.note || "Task Resolution Payout"}</p>
                       <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-white/5">
                          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Paid Out</span>
                          <span className="text-xl font-black text-slate-900 dark:text-white">₹{tx.amount.toLocaleString()}</span>
                       </div>
                     </div>
                   ))
                 )}
              </div>
              <div className="p-6 mt-auto bg-slate-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/5">
                 <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lifetime Payout</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">₹{transactions.reduce((s,t)=>s+t.amount,0).toLocaleString()}</p>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}

export default function WorkerDashboardPage() {
  return (
    <ProtectedRoute>
      <WorkerContent />
    </ProtectedRoute>
  );
}
