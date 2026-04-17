// ============================================
// Worker Dashboard — Task Resolution Flow
// ============================================
"use client";

import React, { useEffect, useState } from "react";
import { useAuthContext } from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueCard from "@/components/IssueCard";
import { Issue, IssueStatus } from "@/types";
import { subscribeToAllIssues, updateIssueStatus, assignIssue } from "@/lib/firestore";
import { getSuggestedSolution } from "@/services/aiAssistService";

function WorkerIssueCard({ issue, workerId }: { issue: Issue, workerId: string }) {
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

    if (issue.assignedTo === workerId) {
      fetchSuggestion();
    }
  }, [issue, workerId]);

  const handleStatusChange = async (newStatus: IssueStatus) => {
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
    <div className="relative glass rounded-2xl overflow-hidden border border-gray-800/50 flex flex-col">
      <div className="p-1">
        <IssueCard issue={issue} showActions={false} />
      </div>

      {issue.assignedTo === workerId && (
        <div className="mx-4 mb-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <p className="text-sm font-semibold text-indigo-400 flex items-center gap-2 mb-2">
            <span>💡</span> AI Suggested Solution
          </p>
          {loadingSuggestion ? (
            <p className="text-sm text-gray-500 animate-pulse">Analyzing issue...</p>
          ) : (
            <p className="text-sm text-gray-300 leading-relaxed">{suggestion}</p>
          )}
        </div>
      )}

      {/* Worker Action Buttons */}
      <div className="mt-auto p-4 pt-0">
        {!issue.assignedTo && (
          <button
            onClick={handleTakeTask}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-800 hover:bg-gray-700 transition border border-gray-700 text-white"
          >
            Take Task
          </button>
        )}

        {issue.assignedTo === workerId && (
          <div className="flex items-center gap-3">
            {issue.status === "Open" && (
              <button
                onClick={() => handleStatusChange("In Progress")}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 text-white"
              >
                Start Work
              </button>
            )}
            {issue.status === "In Progress" && (
              <button
                onClick={() => handleStatusChange("Resolved")}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 transition shadow-lg shadow-emerald-500/20 text-white"
              >
                Mark as Resolved
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkerContent() {
  const { userProfile } = useAuthContext();
  const [assignedIssues, setAssignedIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.id) return;
    let active = true;
    const unsubscribe = subscribeToAllIssues((allIssues) => {
      if (!active) return;
      const myIssues = allIssues.filter(i =>
        (i.assignedTo === userProfile.id || !i.assignedTo) && i.status !== "Resolved"
      );
      setAssignedIssues(myIssues);
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.id]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Worker Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review, accept, and resolve pending campus issues. Unassigned issues and your tasks are below.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading open tasks...</p>
          </div>
        </div>
      ) : assignedIssues.length === 0 ? (
        <div className="text-center py-20 bg-gray-900/50 rounded-xl border border-gray-800">
          <h3 className="text-lg font-medium text-white mb-2">You are all caught up!</h3>
          <p className="text-sm text-gray-500">
            No active issues are assigned to you and there are no unassigned issues right now.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {assignedIssues.map(issue => (
            <WorkerIssueCard key={issue.id} issue={issue} workerId={userProfile!.id} />
          ))}
        </div>
      )}
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
