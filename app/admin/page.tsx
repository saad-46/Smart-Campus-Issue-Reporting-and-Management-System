// ============================================
// Admin Dashboard — Manage All Campus Issues
// ============================================
// Shows all reported issues with filtering,
// status updates, and assignment capabilities.

"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueCard from "@/components/IssueCard";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { Issue, IssueStatus, Priority } from "@/types";
import {
  subscribeToAllIssues,
  updateIssueStatus,
  assignIssue,
} from "@/lib/firestore";

function AdminContent() {
  const { userProfile } = useAuthContext();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Subscribe to real-time updates for ALL issues
  useEffect(() => {
    const unsubscribe = subscribeToAllIssues((allIssues) => {
      setIssues(allIssues);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Apply filters
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesStatus =
        statusFilter === "all" || issue.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || issue.priority === priorityFilter;
      const matchesSearch =
        searchQuery === "" ||
        issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        issue.category.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [issues, statusFilter, priorityFilter, searchQuery]);

  // Admin actions
  const handleStatusChange = async (issueId: string, status: IssueStatus) => {
    try {
      await updateIssueStatus(issueId, status);
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleAssign = async (issueId: string) => {
    if (!userProfile) return;
    try {
      await assignIssue(issueId, userProfile.id);
    } catch (error) {
      console.error("Failed to assign issue:", error);
    }
  };

  // Summary stats
  const totalCount = issues.length;
  const openCount = issues.filter((i) => i.status === "Open").length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved").length;
  const highPriorityCount = issues.filter((i) => i.priority === "High" && i.status !== "Resolved").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Manage and resolve all campus issues
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-white">{totalCount}</p>
          <p className="text-xs text-gray-500 mt-1">Total Issues</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-blue-400">{openCount}</p>
          <p className="text-xs text-gray-500 mt-1">Open</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-400">{inProgressCount}</p>
          <p className="text-xs text-gray-500 mt-1">In Progress</p>
        </div>
        <div className="glass rounded-xl p-4">
          <p className="text-2xl font-bold text-emerald-400">{resolvedCount}</p>
          <p className="text-xs text-gray-500 mt-1">Resolved</p>
        </div>
        <div className="glass rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-2xl font-bold text-red-400">{highPriorityCount}</p>
          <p className="text-xs text-gray-500 mt-1">High Priority</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            placeholder="Search issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All Statuses" },
              { value: "Open", label: "Open" },
              { value: "In Progress", label: "In Progress" },
              { value: "Resolved", label: "Resolved" },
            ]}
          />
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            options={[
              { value: "all", label: "All Priorities" },
              { value: "High", label: "🔴 High" },
              { value: "Medium", label: "🟡 Medium" },
              { value: "Low", label: "🟢 Low" },
            ]}
          />
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          Showing {filteredIssues.length} of {issues.length} issues
        </p>
        {(statusFilter !== "all" || priorityFilter !== "all" || searchQuery) && (
          <button
            onClick={() => {
              setStatusFilter("all");
              setPriorityFilter("all");
              setSearchQuery("");
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Issues List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading all issues...</p>
          </div>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">
            {issues.length === 0 ? "No issues reported yet" : "No issues match your filters"}
          </h3>
          <p className="text-sm text-gray-500">
            {issues.length === 0
              ? "Issues will appear here when users report them"
              : "Try adjusting your filters"}
          </p>
        </div>
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

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute requiredRole="admin">
      <AdminContent />
    </ProtectedRoute>
  );
}
