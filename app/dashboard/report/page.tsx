"use client";

import React, { useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueForm from "@/components/IssueForm";
import ChatReporter from "@/components/ChatReporter";
import Link from "next/link";
import { useAuthContext } from "@/components/AuthProvider";

function ReportContent() {
  const { userProfile } = useAuthContext();
  const [tab, setTab] = useState<"chat" | "manual">("chat");

  // Back link goes to the correct dashboard for this user's role
  const backHref =
    userProfile?.role === "admin" ? "/admin" :
    userProfile?.role === "worker" ? "/worker" :
    "/dashboard";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <Link href={backHref} className="hover:text-purple-500 transition-colors">
          Dashboard
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-700 dark:text-gray-300">Report Issue</span>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Report a Campus Issue
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Describe the issue and our AI will automatically categorize and prioritize it.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-6 w-fit">
        {(["chat", "manual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t
                ? "bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
          >
            {t === "chat" ? "🤖 AI Chat" : "📝 Manual Form"}
          </button>
        ))}
      </div>

      {/* Form card */}
      <div className="glass p-6 sm:p-8">
        {tab === "chat" ? <ChatReporter /> : <IssueForm />}
      </div>
    </div>
  );
}

export default function ReportIssuePage() {
  return (
    <ProtectedRoute>
      <ReportContent />
    </ProtectedRoute>
  );
}
