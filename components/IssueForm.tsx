// ============================================
// IssueForm — Form for Reporting New Issues
// ============================================
// Calls the AI service on submit to auto-categorize
// and determine priority before saving to Firestore.

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/components/AuthProvider";
import { createIssue } from "@/lib/firestore";
import { analyzeIssue } from "@/services/aiService";
import { AIAnalysisResult } from "@/types";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PriorityBadge } from "@/components/ui/Badge";

export default function IssueForm() {
  const { userProfile } = useAuthContext();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");

  // Step 1: Analyze with AI
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !description.trim() || !location.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeIssue(description);
      setAiResult(result);
      setStep("review");
    } catch {
      setError("AI analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 2: Submit to Firestore
  const handleSubmit = async () => {
    if (!userProfile || !aiResult) return;

    setIsSubmitting(true);
    setError("");

    try {
      await createIssue(
        { title, description, location },
        userProfile.id,
        userProfile.name,
        aiResult.category,
        aiResult.priority
      );
      router.push("/dashboard");
    } catch {
      setError("Failed to submit issue. Please try again.");
      setIsSubmitting(false);
    }
  };

  if (step === "review" && aiResult) {
    return (
      <div className="space-y-6">
        {/* AI Analysis Result */}
        <Card className="border-indigo-500/30 bg-indigo-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-indigo-400">AI Analysis Complete</h3>
              <p className="text-xs text-gray-500">Our AI has categorized your issue</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Category</p>
              <p className="text-sm font-medium text-white">{aiResult.category}</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Priority</p>
              <PriorityBadge priority={aiResult.priority} />
            </div>
          </div>
        </Card>

        {/* Issue Summary */}
        <Card>
          <h3 className="text-sm font-medium text-gray-400 mb-3">Issue Summary</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">Title</p>
              <p className="text-sm text-white">{title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Description</p>
              <p className="text-sm text-gray-300">{description}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Location</p>
              <p className="text-sm text-white">{location}</p>
            </div>
          </div>
        </Card>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setStep("form")}
            className="flex-1"
          >
            ← Edit Details
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            className="flex-1"
          >
            Submit Issue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleAnalyze} className="space-y-5">
      <Input
        label="Issue Title"
        placeholder="e.g., Broken light in corridor"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <Textarea
        label="Description"
        placeholder="Describe the issue in detail. The more you describe, the better our AI can categorize it..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={5}
      />

      <Input
        label="Location"
        placeholder="e.g., Building A, Room 201"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        required
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        }
      />

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
          {error}
        </div>
      )}

      <Button type="submit" isLoading={isAnalyzing} className="w-full" size="lg">
        {isAnalyzing ? "Analyzing with AI..." : "Analyze & Continue →"}
      </Button>

      <p className="text-xs text-gray-600 text-center">
        Our AI will automatically categorize your issue and assign a priority level
      </p>
    </form>
  );
}
