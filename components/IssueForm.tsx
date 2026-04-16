"use client";

import React, { useState, useRef } from "react";
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

const MAX_SIZE_MB = 5;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export default function IssueForm() {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "review">("form");

  // ── Image handling ──────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError("");
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      setImageError("Only JPG, PNG or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setImageError(`Image must be smaller than ${MAX_SIZE_MB}MB.`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview("");
    setImageError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Step 1: AI analysis ─────────────────────────────────────
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !description.trim() || !location.trim()) {
      setError("Please fill in all required fields.");
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

  // ── Step 2: Submit ──────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userProfile || !aiResult) return;
    setIsSubmitting(true);
    setError("");
    try {
      let finalImageUrl = imagePreview || undefined;

      // Intercept and upload to real storage if file exists
      if (fileRef.current?.files?.[0]) {
        const { uploadImage } = await import("@/services/storageService");
        finalImageUrl = await uploadImage(fileRef.current.files[0], "issues");
      }

      await createIssue(
        { title, description, location },
        userProfile.id,
        userProfile.name,
        aiResult.category,
        aiResult.priority,
        finalImageUrl
      );
      router.push("/dashboard");
    } catch {
      setError("Failed to submit issue. Please try again.");
      setIsSubmitting(false);
    }
  };

  // ── Review step ─────────────────────────────────────────────
  if (step === "review" && aiResult) {
    return (
      <div className="space-y-6">
        <Card className="border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-purple-400">AI Analysis Complete</h3>
              <p className="text-xs text-gray-500">Your issue has been categorized</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Category</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{aiResult.category}</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Priority</p>
              <PriorityBadge priority={aiResult.priority} />
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Issue Summary</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400">Title</p>
              <p className="text-sm text-gray-900 dark:text-white">{title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Description</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">{description}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Location</p>
              <p className="text-sm text-gray-900 dark:text-white">{location}</p>
            </div>
            {imagePreview && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Attached Image</p>
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-h-48 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                />
              </div>
            )}
          </div>
        </Card>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
        )}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setStep("form")} className="flex-1">
            ← Edit Details
          </Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting} className="flex-1">
            Submit Issue
          </Button>
        </div>
      </div>
    );
  }

  // ── Form step ───────────────────────────────────────────────
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
        placeholder="Describe the issue in detail — the more context, the better our AI can categorize it."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
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

      {/* ── Image Upload ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Attach Image <span className="text-gray-400 font-normal">(optional · JPG/PNG/WebP · max 5 MB)</span>
        </label>

        {imagePreview ? (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-56 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors shadow-lg"
              aria-label="Remove image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
              ✓ Image attached
            </div>
          </div>
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageChange}
              className="hidden"
              id="issue-image"
            />
            <label
              htmlFor="issue-image"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/5 transition-all duration-200 group"
            >
              <svg className="w-10 h-10 text-gray-400 group-hover:text-purple-500 transition-colors mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors">
                Click to upload a photo
              </p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG or WebP up to 5 MB</p>
            </label>
          </>
        )}

        {imageError && (
          <p className="mt-2 text-sm text-red-500">{imageError}</p>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>
      )}

      <Button type="submit" isLoading={isAnalyzing} className="w-full" size="lg">
        {isAnalyzing ? "Analyzing with AI…" : "Analyze & Continue →"}
      </Button>

      <p className="text-xs text-gray-400 text-center">
        AI will automatically categorize your issue and assign a priority level
      </p>
    </form>
  );
}
