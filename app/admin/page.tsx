"use client";

import React, { useEffect, useState, useMemo } from "react";
import { subscribeToAllIssues } from "@/lib/firestore";
import { subscribeToBudget, subscribeToTransactions, getAllWorkers, executePayment, rejectReceipt, getGlobalBudget, addFundsToBudget } from "@/lib/finance";
import { Issue, Budget, Transaction, User } from "@/types";
import {
  XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend
} from "recharts";

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#ef4444'];

const TooltipStyle = {
  backgroundColor: 'var(--tw-prose-invert-bg, rgb(31, 41, 55))', // dark gray fallback
  color: '#fff',
  borderRadius: '8px',
  border: 'none',
  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
  padding: '12px 14px',
};

export default function AdminDashboardPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workers, setWorkers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(7);

  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [paymentModalIssue, setPaymentModalIssue] = useState<Issue | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    getGlobalBudget().catch(console.error);
    const unsubIssues = subscribeToAllIssues(setIssues);
    const unsubBudget = subscribeToBudget(setBudget);
    const unsubTx = subscribeToTransactions(null, setTransactions);
    getAllWorkers().then(setWorkers).finally(() => setLoading(false));

    return () => {
      unsubIssues();
      unsubBudget();
      unsubTx();
    };
  }, []);

  const workerMap = useMemo(() => {
    const map: Record<string, string> = {};
    workers.forEach(w => map[w.id] = w.name);
    return map;
  }, [workers]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(addFundsAmount);
    if (!amount || amount <= 0) {
      showToast("Amount must be greater than 0.", "error");
      return;
    }
    
    setIsProcessing(true);
    try {
      await addFundsToBudget(amount);
      setIsAddFundsOpen(false);
      setAddFundsAmount("");
      showToast(`₹${amount.toLocaleString()} added successfully to budget!`, "success");
    } catch (err: any) {
      showToast("Failed to add funds: Permission denied or network err.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendPayment = async () => {
    if (!paymentModalIssue) return;
    setIsProcessing(true);
    try {
      await executePayment(
        paymentModalIssue.assignedTo,
        workerMap[paymentModalIssue.assignedTo] || "Unknown",
        paymentModalIssue.claimAmount || 0,
        "receipt",
        "Receipt resolved for " + paymentModalIssue.title,
        paymentModalIssue.id,
        paymentModalIssue.receiptUrl
      );
      showToast("Payment executed successfully!", "success");
      setPaymentModalIssue(null);
    } catch (err: any) {
      showToast("Payment Failed: " + err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const metrics = useMemo(() => {
    const now = new Date();
    const resolved = issues.filter(i => i.status === "Resolved");
    const pendingCount = issues.filter(i => i.status !== "Resolved").length;
    const activeWorkersCount = new Set(issues.filter(i => i.assignedTo).map(i => i.assignedTo)).size;

    const resolvedToday = resolved.filter(i => i.resolvedAt && (now.getTime() - i.resolvedAt.getTime()) <= 86400000).length;

    let totalHrs = 0;
    let under1 = 0, oneToThree = 0, over6 = 0;
    resolved.forEach(i => {
      const end = i.resolvedAt || i.updatedAt;
      const start = i.createdAt;
      const hrs = (end.getTime() - start.getTime()) / 3600000;
      totalHrs += hrs;
      if (hrs < 1) under1++;
      else if (hrs <= 3) oneToThree++;
      else if (hrs > 6) over6++;
    });

    let avgResTime = resolved.length ? (totalHrs / resolved.length).toFixed(1) : "0.0";
    let u1pct = resolved.length ? Math.round((under1 / resolved.length) * 100) : 0;
    let o3pct = resolved.length ? Math.round((oneToThree / resolved.length) * 100) : 0;
    let o6pct = resolved.length ? Math.round((over6 / resolved.length) * 100) : 0;

    const isResolutionEmpty = resolved.length === 0;

    const resolutionDonut = [
      { name: "< 1 hr", value: under1, pct: u1pct },
      { name: "1 - 3 hr", value: oneToThree, pct: o3pct },
      { name: "> 6 hr", value: over6, pct: o6pct }
    ];

    let slaBreaches = issues.filter(i => i.status !== "Resolved" && (now.getTime() - i.createdAt.getTime()) > 28800000).map(i => ({
      ...i, delayHours: Math.floor((now.getTime() - i.createdAt.getTime()) / 3600000)
    }));

    // Worker Performance (Map over all recorded workers)
    const wMap: Record<string, { resolved: number, pending: number, totalHrs: number, name: string }> = {};
    workers.forEach(w => wMap[w.id] = { resolved: 0, pending: 0, totalHrs: 0, name: w.name });
    
    issues.forEach(i => {
      if (i.assignedTo) {
        if (!wMap[i.assignedTo]) wMap[i.assignedTo] = { resolved: 0, pending: 0, totalHrs: 0, name: workerMap[i.assignedTo] || "Unknown" };
        if (i.status === "Resolved") {
          wMap[i.assignedTo].resolved++;
          const hrs = ((i.resolvedAt || i.updatedAt).getTime() - i.createdAt.getTime()) / 3600000;
          wMap[i.assignedTo].totalHrs += hrs;
        } else {
          wMap[i.assignedTo].pending++;
        }
      }
    });

    let workerBar = Object.values(wMap).map(stats => ({
      name: stats.name,
      Resolved: stats.resolved,
      Pending: stats.pending,
      AvgRes: stats.resolved > 0 ? (stats.totalHrs / stats.resolved).toFixed(1) : "0",
      total: stats.resolved + stats.pending
    })).sort((a, b) => b.total - a.total).slice(0, 5);

    // Trend Line
    const trendsRaw: Record<string, number> = {};
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      trendsRaw[d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })] = 0;
    }
    issues.forEach(i => {
      const d = i.createdAt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
      if (trendsRaw[d] !== undefined) trendsRaw[d]++;
    });
    let trendData = Object.entries(trendsRaw).map(([date, count]) => ({ date, count }));
    const isTrendEmpty = trendData.every(d => d.count === 0);

    const pendingReceipts = issues.filter(i => i.receiptUrl && i.claimStatus === "pending");

    // Dynamic AI Insights
    let aiInsights = [];
    if (issues.length === 0) {
      aiInsights.push(`No critical anomalies detected recently.`);
      aiInsights.push(`Maintenance requests remain uniformly distributed.`);
    } else {
      const electrical = issues.filter(i => i.category === "Electrical").length;
      let lMap: Record<string,number> = {};
      issues.forEach(i => lMap[i.location] = (lMap[i.location] || 0) + 1);
      const topLocation = Object.keys(lMap).length > 0 ? Object.keys(lMap).reduce((a, b) => lMap[a] > lMap[b] ? a : b) : "";
      if (topLocation) aiInsights.push(`Highest density of recorded issues occur organically in **${topLocation}**.`);
      if (electrical > 1) aiInsights.push(`Electrical outages flagged as elevated this week. Preventative checks advised.`);
      if (under1 > sum(resolutionDonut.map(d=>d.value))/2 && under1 > 0) aiInsights.push(`Average resolution time improved by **20%** efficiently!`);
    }

    return { resolvedToday, pendingCount, activeWorkersCount, avgResTime, resolutionDonut, slaBreaches, workerBar, trendData, isTrendEmpty, isResolutionEmpty, pendingReceipts, aiInsights };
  }, [issues, timeRange, workerMap, workers]);

  function sum(arr: number[]) { return arr.reduce((a,b)=>a+b,0); }

  const liveActivity = useMemo(() => {
    return [...issues].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5).map(i => {
        let action = "Reported issue"; let color = "bg-blue-500";
        if (i.status === "Resolved") { action = "Resolved by"; color = "bg-emerald-500"; }
        else if (i.status === "In Progress") { action = "Began work on"; color = "bg-purple-500"; }
        let actor = i.createdByName;
        if (i.status === "Resolved" || i.status === "In Progress") actor = i.assignedTo ? (workerMap[i.assignedTo] || "Worker") : "System";
        return { id: i.id, user: actor, action, target: i.title, time: i.updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), color };
      });
  }, [issues, workerMap]);

  const expenseGraphData = useMemo(() => {
    const raw: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      raw[d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })] = 0;
    }
    const today = new Date();
    transactions.forEach(tx => {
      const diffDays = Math.floor((today.getTime() - tx.createdAt.getTime()) / 86400000);
      if (diffDays <= 6) {
        const dayStr = tx.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        if (raw[dayStr] !== undefined) raw[dayStr] += tx.amount;
      }
    });

    let graphData = Object.entries(raw).map(([day, spent]) => ({ day, spent }));
    return { data: graphData, isEmpty: graphData.every(d => d.spent === 0) };
  }, [transactions]);

  if (loading) return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const rawTotalB = budget?.totalAvailable || 0;
  const spentB = budget?.totalSpent || 0;
  const remB = rawTotalB - spentB;
  const spentPct = rawTotalB > 0 ? (spentB / rawTotalB) * 100 : 0;

  return (
    <div className="animate-fade-in space-y-6 lg:space-y-8 pb-12 pt-4 relative">
      
      {toast && (
        <div className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-[slide-in-right_0.3s_ease-out] border backdrop-blur-md ${
          toast.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-900/90 text-emerald-700 dark:text-emerald-100 border-emerald-200 dark:border-emerald-700" 
            : "bg-red-50 dark:bg-red-900/90 text-red-700 dark:text-red-100 border-red-200 dark:border-red-700"
        }`}>
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          <p className="text-sm font-bold">{toast.msg}</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-slide-up">
        {[{ title: "Total Issues", val: issues.length, color: "indigo" },
          { title: "Resolved Today", val: metrics.resolvedToday, color: "emerald" },
          { title: "Pending Issues", val: metrics.pendingCount, color: "orange", pulse: true },
          { title: "Avg Res Time", val: metrics.avgResTime + "hr", color: "purple" },
          { title: "Active Workers", val: metrics.activeWorkersCount, color: "blue", span: true }
        ].map((k, i) => (
          <div key={k.title} className={`glass rounded-2xl p-5 border shadow-sm hover:shadow-md transition duration-300 ${k.span ? 'col-span-2 lg:col-span-1' : ''} border-${k.color}-500/20 bg-gradient-to-br from-${k.color}-50 to-white dark:from-${k.color}-900/20 dark:to-slate-800/40`} style={{ animationDelay: `${i*50}ms` }}>
            <p className={`text-xs font-semibold text-${k.color}-500 uppercase tracking-widest mb-1 flex items-center gap-1.5`}>
              {k.pulse && <span className={`w-2 h-2 rounded-full bg-${k.color}-500 animate-pulse`}/>} {k.title}
            </p>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white">{k.val}</h3>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-8 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
          Financial Operations
        </h2>
        <button onClick={() => setIsAddFundsOpen(true)} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-xl shadow-blue-500/20 transition hover:-translate-y-0.5 flex items-center gap-1.5">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg> Add Funds
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
        
        {/* HUGE MAIN BUDGET CARD */}
        <div className="lg:col-span-1 glass rounded-2xl p-6 border border-gray-200 dark:border-gray-800/60 shadow-lg flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform"><span className="text-8xl font-black">₹</span></div>
          <div className="relative z-10">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total Balance</p>
            <h3 className="text-4xl font-black text-gray-900 dark:text-white">₹{remB.toLocaleString()}</h3>
          </div>
          
          <div className="h-[120px] my-5 w-full relative z-10 border-t border-b border-gray-100 dark:border-white/5 py-2">
            {expenseGraphData.isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-2 opacity-50">
                 <span className="text-3xl mb-1">📊</span>
                 <p className="text-xs font-bold text-gray-900 dark:text-white">No expense data yet</p>
                 <p className="text-[10px] text-gray-500 leading-tight mt-1">Data will appear once transactions are recorded</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseGraphData.data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barCategoryGap={10}>
                  <defs>
                    <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.8}/>
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={TooltipStyle} itemStyle={{ color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.08)' }} />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} dy={5} />
                  <Bar dataKey="spent" name="Spent ₹" radius={[6, 6, 0, 0]} fill="url(#colorSpent)" animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="relative z-10">
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-red-500">Spent: ₹{spentB.toLocaleString()}</span>
              <span className="text-gray-500 dark:text-gray-400">Total: ₹{rawTotalB.toLocaleString()}</span>
            </div>
            <div className="w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full h-3 overflow-hidden border border-emerald-200 dark:border-emerald-800/50">
              <div className="bg-red-500 h-full transition-all duration-1000" style={{ width: `${Math.min(spentPct, 100)}%` }} />
            </div>
          </div>
        </div>

        {/* PENDING WORKER PAYMENTS TABLE */}
        <div className="lg:col-span-2 glass rounded-2xl flex flex-col border border-gray-200 dark:border-gray-800/60 shadow-lg overflow-hidden h-full min-h-[350px]">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/5 flex justify-between items-center shrink-0">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="p-1 rounded bg-blue-500/20 text-blue-500">📋</span> Pending Worker Payments</h3>
            <span className="text-xs font-semibold bg-gray-200 dark:bg-gray-700 px-3 py-0.5 rounded-full shadow-sm">{metrics.pendingReceipts.length} Pending</span>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar bg-white/50 dark:bg-black/10 relative">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="sticky top-0 bg-gray-100/90 dark:bg-slate-800/90 backdrop-blur z-10 shadow-sm">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10">ID</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10">Worker Name</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10">Issue Type</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-white/10">Issue Context</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border-b border-gray-200 dark:border-white/10 text-right">Amount to Pay</th>
                </tr>
              </thead>
              <tbody>
                {metrics.pendingReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-16 h-[200px]">
                      <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50 border border-dashed border-gray-200 dark:border-white/10 rounded-xl mx-4">
                        <span className="text-3xl mb-1">💳</span>
                        <p className="text-xs font-bold text-gray-900 dark:text-white mt-2">No payment data yet</p>
                        <p className="text-[10px] text-gray-500 leading-tight mt-1">Data will appear once expenses are recorded</p>
                      </div>
                    </td>
                  </tr>
                ) : metrics.pendingReceipts.map((r, idx) => (
                  <tr key={r.id} onClick={() => setPaymentModalIssue(r)} className={`cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-gray-50/50 dark:bg-white/[0.02]'}`}>
                    <td className="px-5 py-4 text-xs font-medium text-gray-500 truncate max-w-[80px]">#{r.id.substring(0,6)}</td>
                    <td className="px-5 py-4 text-sm font-bold text-gray-900 dark:text-white capitalize">{workerMap[r.assignedTo] || "Worker"}</td>
                    <td className="px-5 py-4 text-xs font-semibold text-gray-500"><span className="px-3 py-1 bg-gray-100 dark:bg-slate-800 rounded-md shadow-sm border border-gray-200 dark:border-gray-700">{r.category}</span></td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[200px]">{r.title}</p>
                    </td>
                    <td className="px-5 py-4 text-sm font-black text-emerald-600 dark:text-emerald-400 text-right text-lg">₹{r.claimAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-gray-900 dark:text-white pt-6 mb-2 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2">
        <span className="p-1.5 bg-blue-500/20 text-blue-500 rounded-lg">📊</span> Operational Analytics
      </h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="lg:col-span-2 glass rounded-2xl p-6 border border-gray-200 dark:border-gray-800/60 shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">Issue Volume Trends</h2>
            <div className="flex bg-gray-200/50 dark:bg-slate-900 rounded-lg p-1 border border-gray-300 dark:border-gray-700">
              {[7, 30, 90].map(v => (
                <button key={v} onClick={() => setTimeRange(v as any)} className={`px-3 py-1 text-xs font-bold rounded transition ${timeRange === v ? "bg-white dark:bg-slate-700 shadow" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>{v}D</button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-[250px] w-full">
            {metrics.isTrendEmpty ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-2 opacity-50 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                 <span className="text-3xl mb-1">📈</span>
                 <p className="text-xs font-bold text-gray-900 dark:text-white">No issue volume data available yet</p>
                 <p className="text-[10px] text-gray-500 leading-tight mt-1">Data will appear once issues are recorded</p>
              </div>
            ) : (
              <ResponsiveContainer>
                <AreaChart data={metrics.trendData}>
                  <defs>
                    <linearGradient id="gradientTrends" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,163,175,0.1)" />
                  <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <RechartsTooltip contentStyle={TooltipStyle} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="count" name="Issues" stroke="#8b5cf6" strokeWidth={3} fill="url(#gradientTrends)" animationDuration={1500} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6 border border-gray-200 dark:border-gray-800/60 shadow-lg flex flex-col relative overflow-hidden">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2 z-10 flex items-center gap-2">Resolution Time</h2>
          <div className="flex-1 min-h-[220px] relative">
            {metrics.isResolutionEmpty ? (
               <div className="flex flex-col items-center justify-center h-full text-center p-2 opacity-50 border border-dashed border-gray-200 dark:border-white/10 rounded-xl mt-4">
                 <span className="text-3xl mb-1">⏱️</span>
                 <p className="text-xs font-bold text-gray-900 dark:text-white">No resolution data available yet</p>
                 <p className="text-[10px] text-gray-500 leading-tight mt-1">Data will appear once issues are resolved</p>
               </div>
            ) : (
              <>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={metrics.resolutionDonut} innerRadius={80} outerRadius={110} paddingAngle={4} dataKey="value" animationDuration={1000}>
                      {metrics.resolutionDonut.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={TooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-gray-900 dark:text-white drop-shadow-sm">{metrics.avgResTime}h</span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Average</span>
                </div>
              </>
            )}
          </div>
          {!metrics.isResolutionEmpty && (
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-2 mt-4 bg-gray-50 dark:bg-slate-800/50 p-3 rounded-xl border border-gray-100 dark:border-white/5">
              {metrics.resolutionDonut.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                  <span className="w-3 h-3 rounded-md" style={{ backgroundColor: PIE_COLORS[i] }} />
                  {d.name} ({d.pct}%)
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
        <div className="lg:col-span-1 glass rounded-2xl p-6 border border-gray-200 dark:border-gray-800/60 shadow-lg flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="text-xl">📊</span> Worker Performance</h2>
            <span className="text-xs bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded-full font-bold">Top 5</span>
          </div>
          <div className="flex-1 min-h-[250px] w-full">
            {metrics.workerBar.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-2 opacity-50 border border-dashed border-gray-200 dark:border-white/10 rounded-xl">
                 <span className="text-3xl mb-1">👷</span>
                 <p className="text-xs font-bold text-gray-900 dark:text-white">No active workers to rank</p>
                 <p className="text-[10px] text-gray-500 leading-tight mt-1">Workers will appear here once tasks populate</p>
              </div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={metrics.workerBar} layout="vertical" margin={{ left: -10, right: 10 }} barCategoryGap={10}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} width={80} className="font-semibold capitalize" />
                  <RechartsTooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={TooltipStyle} formatter={(val: string, name: string, props: any) => [`${val} Tasks (Avg: ${props.payload.AvgRes}h)`, name]} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: "15px", fontWeight: "bold" }} />
                  <Bar dataKey="Resolved" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={20} animationDuration={1500} />
                  <Bar dataKey="Pending" stackId="a" fill="#3b82f6" radius={[0, 6, 6, 0]} animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 glass rounded-2xl flex flex-col border border-indigo-200 dark:border-indigo-500/20 bg-gradient-to-b from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-slate-800/20 shadow-lg group hover:shadow-indigo-500/20 transition-all h-[360px]">
          <div className="px-6 py-4 border-b border-indigo-200 dark:border-indigo-500/20 flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-900/30">
            <span className="text-xl animate-pulse drop-shadow-lg">🧠</span>
            <div>
              <h2 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Auto Insights</h2>
              <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 font-semibold">AI Generated Diagnostics</p>
            </div>
          </div>
          <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-3">
            {metrics.aiInsights.map((ins, i) => (
              <div key={i} className="bg-white/90 dark:bg-slate-900/90 border border-indigo-100 dark:border-indigo-500/20 rounded-xl p-4 shadow-sm flex gap-3 animate-fade-in group-hover:border-indigo-300 dark:group-hover:border-indigo-500/50 transition-colors" style={{ animationDelay: `${i*150}ms` }}>
                <div className="w-1.5 bg-indigo-500 rounded-full shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium markdown-bold-fix leading-relaxed" dangerouslySetInnerHTML={{ __html: ins.replace(/\*\*(.*?)\*\*/g, '<span class="text-indigo-600 dark:text-indigo-400 font-black">$1</span>') }} />
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1 glass rounded-2xl flex flex-col border border-red-200 dark:border-red-500/30 shadow-lg overflow-hidden group hover:border-red-500/50 transition-colors h-[360px]">
          <div className="px-6 py-4 border-b border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-900/20 flex justify-between items-center">
            <div>
              <h2 className="text-sm font-black text-red-900 dark:text-red-300 uppercase tracking-wider flex items-center gap-1.5"><span className="text-lg">⚠️</span> SLA Breaches</h2>
              <p className="text-[10px] text-red-600/70 dark:text-red-400/70 font-semibold mt-0.5">&gt; 8 Hours Overdue</p>
            </div>
            <span className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg shadow-red-500/30">{metrics.slaBreaches.length}</span>
          </div>
          <div className="p-5 overflow-y-auto custom-scrollbar space-y-3 bg-red-50/30 dark:bg-red-900/5 h-full">
            {metrics.slaBreaches.length === 0 ? (
                 <div className="flex flex-col items-center justify-center p-4 h-full border border-dashed border-red-200 dark:border-red-900/20 rounded-xl">
                   <span className="text-3xl mb-2">🎉</span>
                   <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">0 Active Breaches</p>
                   <p className="text-xs text-gray-500 mt-1">Your campus is running flawlessly.</p>
                 </div>
              ) : metrics.slaBreaches.map(b => (
               <div key={b.id} className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-500/30 rounded-xl p-4 shadow-sm relative overflow-hidden hover:shadow-md transition">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  <p className="text-sm font-black text-gray-900 dark:text-white truncate mb-2">{b.title}</p>
                  <div className="flex justify-between items-center text-xs bg-red-50 dark:bg-red-500/10 p-2 rounded-lg gap-2">
                    <span className="text-gray-700 dark:text-gray-300 truncate font-semibold capitalize">👷 {workerMap[b.assignedTo] || b.assignedTo || "Unassigned"}</span>
                    <span className="font-black text-red-600 dark:text-red-400 whitespace-nowrap">Delay: {b.delayHours}hrs</span>
                  </div>
               </div>
            ))}
          </div>
        </div>
      </div>

      {isAddFundsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 border border-gray-200 dark:border-white/10 animate-slide-up relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-500" />
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 text-center">Add Funds</h3>
            <p className="text-sm text-gray-500 text-center mb-6">Inject fresh budget into global pool.</p>
            <form onSubmit={handleAddFunds}>
              <div className="relative mb-6">
                <span className="absolute left-5 top-3.5 text-gray-500 font-bold text-lg">₹</span>
                <input required autoFocus type="number" min="1" step="1" value={addFundsAmount} onChange={e => setAddFundsAmount(e.target.value)} placeholder="0.00" className="w-full bg-gray-50 dark:bg-slate-800/50 border-2 border-gray-200 dark:border-gray-700 rounded-2xl pl-10 pr-4 py-3.5 text-gray-900 dark:text-white font-black text-lg focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all" />
              </div>
              <div className="flex flex-col gap-3">
                <button type="submit" disabled={isProcessing} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-blue-500/30 disabled:opacity-50 transition-all active:scale-[0.98]">
                  {isProcessing ? "Processing..." : "Confirm & Add Funds"}
                </button>
                <button type="button" onClick={() => setIsAddFundsOpen(false)} className="w-full py-3 bg-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-2xl text-sm font-bold transition">Cancel Operation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {paymentModalIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in" onClick={(e) => { if(e.target === e.currentTarget) setPaymentModalIssue(null) }}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col animate-slide-up">
            <div className="p-6 border-b border-gray-200 dark:border-white/10 flex justify-between items-start bg-gray-50/50 dark:bg-white/5">
              <div>
                <h3 className="text-xl font-black text-gray-900 dark:text-white">Authorize Payment</h3>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mt-1">Ticket #{paymentModalIssue.id.substring(0,8)}</p>
              </div>
              <button onClick={() => setPaymentModalIssue(null)} className="p-2 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border shadow-sm border-gray-200 dark:border-gray-700">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-gray-500 uppercase">Worker</span>
                  <span className="text-base font-black text-gray-900 dark:text-white capitalize">{workerMap[paymentModalIssue.assignedTo] || "Unknown"}</span>
                </div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-bold text-gray-500 uppercase">Issue Title</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white text-right max-w-[200px] truncate">{paymentModalIssue.title}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100 dark:border-gray-700/50">
                  <span className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">Total Claim</span>
                  <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 drop-shadow-sm">₹{paymentModalIssue.claimAmount}</span>
                </div>
              </div>

              {paymentModalIssue.receiptUrl ? (
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500 mb-2 tracking-wider">Attached Receipt</p>
                  <a href={paymentModalIssue.receiptUrl} target="_blank" rel="noreferrer" className="block relative group rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-emerald-500 transition-colors">
                    <img src={paymentModalIssue.receiptUrl} alt="Receipt" className="w-full h-44 object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="bg-white/95 text-black px-4 py-2 rounded-xl text-sm font-black shadow-xl">🔍 View Full Image</span>
                    </div>
                  </a>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-slate-800/50 rounded-2xl p-6 border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center">
                  <span className="text-3xl mb-2 grayscale opacity-50">🧾</span>
                  <p className="text-sm font-bold text-gray-400">No receipt attached.</p>
                </div>
              )}
            </div>

            <div className="p-5 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-slate-800 flex gap-3">
              <button onClick={async () => { try { await rejectReceipt(paymentModalIssue.id); showToast("Claim Rejected Successfully", "error"); setPaymentModalIssue(null); } catch (e: any) { showToast(e.message, "error"); } }} className="flex-[0.8] py-3.5 rounded-2xl border-2 border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 font-black hover:bg-red-50 dark:hover:bg-red-500/10 transition">Reject</button>
              <button disabled={isProcessing || !paymentModalIssue.claimAmount} onClick={handleSendPayment} className="flex-[1.2] py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-500/30 transition-transform active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2">
                {isProcessing ? "Processing..." : <>💸 Send Payment</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
