"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import IssueCard from "@/components/IssueCard";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { Issue, IssueStatus } from "@/types";
import { subscribeToAllIssues, assignIssue, updateIssueStatus } from "@/lib/firestore";
import { simulateEscalation } from "@/services/escalationService";
import { analyzeTrends, PredictedIssue } from "@/services/predictionService";
import {
  getResolvedIssuesCount,
  getIssuesByCategory,
  getAverageResolutionTime,
  getPendingIssuesCount
} from "@/services/analyticsService";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CATEGORIES = ["All", "Infrastructure", "Electrical", "Cleanliness", "Safety", "Technology", "Others"];
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

export default function AdminDashboardPage() {
  return <AdminContent />;
}

function AdminContent() {
  const { userProfile } = useAuthContext();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [riskAlerts, setRiskAlerts] = useState<PredictedIssue[]>([]);
  const [escalating, setEscalating] = useState(false);

  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleCategory = (cat: string) => {
    if (cat === "All") {
      setCategoryFilters([]);
      return;
    }
    setCategoryFilters(prev => 
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleStatus = (status: string) => {
    setStatusFilters(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  useEffect(() => {
    const unsub = subscribeToAllIssues((data) => {
      setIssues(data);
      setRiskAlerts(analyzeTrends(data));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      const st = statusFilters.length === 0 || statusFilters.includes(i.status);
      const cat = categoryFilters.length === 0 || categoryFilters.includes(i.category);
      const q = !searchQuery || [i.title, i.description, i.location, i.category].some((f) => f.toLowerCase().includes(searchQuery.toLowerCase()));
      return st && cat && q;
    });
  }, [issues, statusFilters, categoryFilters, searchQuery]);

  const handleAssign = async (id: string) => {
    if (!userProfile) return;
    try { await assignIssue(id, userProfile.id); } catch (e) { console.error(e); }
  };

  const handleStatusChange = async (id: string, status: IssueStatus) => {
    try { await updateIssueStatus(id, status); } catch (e) { console.error(e); }
  };

  const generateReport = () => {
    const headers = "ID,Title,Category,Priority,Status,Location,CreatedAt\n";
    const csvRules = issues.map(i =>
      `"${i.id}","${i.title}","${i.category}","${i.priority}","${i.status}","${i.location}","${i.createdAt.toISOString()}"`
    ).join("\n");
    
    const blob = new Blob([headers + csvRules], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `issue_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Analytics Metrics
  const resolvedCount = getResolvedIssuesCount(issues);
  const pendingCount = getPendingIssuesCount(issues);
  const categoryData = getIssuesByCategory(issues);
  const resTimeData = getAverageResolutionTime(issues);

  const barData = [
    { name: "< 24h", count: resTimeData.fastCount },
    { name: ">= 24h", count: resTimeData.slowCount },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Operations & Analytics</h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitor system performance and assign issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateReport}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition text-sm font-medium"
          >
            Export Full Report (CSV)
          </button>
          <button
            onClick={async () => {
              setEscalating(true);
              const count = await simulateEscalation(issues);
              alert(`Simulation complete. Escalated ${count} issue(s).`);
              setEscalating(false);
            }}
            disabled={escalating}
            className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2 text-sm font-medium"
          >
            {escalating ? "Running..." : "Run Escalation Check"}
          </button>
        </div>
      </div>

      {riskAlerts.length > 0 && (
        <div className="mb-8 p-6 glass border-red-500/30 rounded-xl">
          <h2 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
            <span>⚠️</span> Predicted Issues
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {riskAlerts.map((alert, idx) => (
              <div key={idx} className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex flex-col gap-1">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-white">{alert.issueType}</span>
                  <span className="px-2 py-0.5 rounded text-xs tracking-wide bg-red-600 font-bold text-white uppercase">{alert.riskLevel} Risk</span>
                </div>
                <p className="text-sm text-gray-300 mt-2 flex gap-2 items-center">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  {alert.location}
                </p>
                <p className="text-xs text-red-300 mt-2 border-t border-red-500/20 pt-2">
                  High probability of recurring {alert.issueType.toLowerCase()} issue in {alert.location}.
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* KPI Panel */}
        <div className="glass rounded-xl p-6 flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">Overview</h3>
          <div>
            <p className="text-3xl font-bold text-blue-400">{resolvedCount}</p>
            <p className="text-sm text-gray-400">Total Resolved</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-400">{pendingCount}</p>
            <p className="text-sm text-gray-400">Total Pending</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-purple-400">{resTimeData.averageHours}h</p>
            <p className="text-sm text-gray-400">Avg Resolution Time</p>
          </div>
        </div>

        {/* Pie Chart: Categories */}
        <div className="glass rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Issues by Category</h3>
          <div className="flex-1 min-h-[200px]">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-gray-500">No data</div>
            )}
          </div>
        </div>

        {/* Bar Chart: Resolution Time */}
        <div className="glass rounded-xl p-6 flex flex-col">
          <h3 className="text-lg font-semibold text-white mb-4">Resolution Speeds</h3>
          <div className="flex-1 min-h-[200px]">
            {resolvedCount > 0 ? (
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={barData}>
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} allowDecimals={false} />
                  <Tooltip 
                    cursor={{fill: 'rgba(255,255,255,0.1)'}} 
                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-sm text-gray-500">No resolved issues yet</div>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mb-6">Issue Assignment Board</h2>

      {/* Advanced Tag Multi-Filtering */}
      <div className="glass p-5 rounded-2xl mb-8 border border-gray-800/80 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <Input
            placeholder="Regex / Keyword search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>}
          />
        </div>
        
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Categories (Multi-Select)</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleCategory("All")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                categoryFilters.length === 0
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/50"
                  : "bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800"
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.filter(c => c !== "All").map((cat) => {
              const active = categoryFilters.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    active
                      ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/20"
                      : "bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800 hover:text-gray-300"
                  }`}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Statuses (Multi-Select)</p>
          <div className="flex flex-wrap gap-2">
            {["Open", "In Progress", "Resolved"].map((status) => {
              const active = statusFilters.includes(status);
              return (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                    active
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "bg-gray-900 text-gray-400 border-gray-800 hover:bg-gray-800 hover:text-gray-300"
                  }`}
                >
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />}
                  {status}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mt-10" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredIssues.map((issue) => (
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
