// ============================================
// Report Issue Page
// ============================================
// Two-step flow: fill form → AI analysis → review → submit

"use client";

import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import IssueForm from "@/components/IssueForm";
import Link from "next/link";

function ReportContent() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/dashboard" className="hover:text-gray-300 transition-colors">
          My Issues
        </Link>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-300">Report Issue</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Report a Campus Issue</h1>
        <p className="text-sm text-gray-400">
          Describe the issue and our AI will automatically categorize and prioritize it.
        </p>
      </div>

      {/* Form Card */}
      <div className="glass rounded-2xl p-6 sm:p-8">
        <IssueForm />
      </div>
    </div>
  );
}

export default function ReportIssuePage() {
  return (
    <ProtectedRoute requiredRole="user">
      <ReportContent />
    </ProtectedRoute>
  );
}
