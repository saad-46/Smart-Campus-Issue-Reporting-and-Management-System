// ============================================
// User Dashboard — List of Reported Issues
// ============================================

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueCard from "@/components/IssueCard";
import Button from "@/components/ui/Button";
import { Issue } from "@/types";
import { subscribeToUserIssues } from "@/lib/firestore";

function DashboardContent() {
  const { userProfile } = useAuthContext();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to real-time updates of user's issues
  useEffect(() => {
    if (!userProfile) return;

    const unsubscribe = subscribeToUserIssues(userProfile.id, (updatedIssues) => {
      setIssues(updatedIssues);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  // Summary stats
  const openCount = issues.filter((i) => i.status === "Open").length;
  const inProgressCount = issues.filter((i) => i.status === "In Progress").length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved").length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">My Issues</h1>
          <p className="text-sm text-gray-400 mt-1">
            Track and manage your reported campus issues
          </p>
        </div>
        <Link href="/dashboard/report">
          <Button>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Report New Issue
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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
      </div>

      {/* Issues List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading your issues...</p>
          </div>
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No issues reported yet</h3>
          <p className="text-sm text-gray-500 mb-6">
            Start by reporting your first campus issue
          </p>
          <Link href="/dashboard/report">
            <Button>Report Your First Issue</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function UserDashboardPage() {
  return (
    <ProtectedRoute requiredRole="user">
      <DashboardContent />
    </ProtectedRoute>
  );
}
