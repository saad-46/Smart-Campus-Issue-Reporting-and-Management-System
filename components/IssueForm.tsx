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
import ImageEditor from "@/components/ImageEditor";

const MAX_SIZE_MB = 5;
const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export default function IssueForm() {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
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
    reader.onloadend = () => setImages((prev) => [...prev, reader.result as string]);
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditorSave = (editedImage: string) => {
    if (editingImageIndex !== null) {
      setImages((prev) => {
        const copy = [...prev];
        copy[editingImageIndex] = editedImage;
        return copy;
      });
    }
    setEditingImageIndex(null);
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
    console.log("Submitting issue...", { title, description, location, category: aiResult.category, priority: aiResult.priority });

    try {
      // Store base64 images directly — no Firebase Storage needed
      // Compress large images to keep Firestore document size reasonable
      const finalImageUrls: string[] = images.slice(0, 3); // max 3 images

      await createIssue(
        { title, description, location },
        userProfile.id,
        userProfile.name,
        aiResult.category,
        aiResult.priority,
        finalImageUrls
      );

      console.log("✅ Issue submitted successfully!");
      router.push("/dashboard");
    } catch (err) {
      console.error("❌ Submit failed:", err);
      setError("Failed to submit issue. Please check your connection and try again.");
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
            {images.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-2">Attached Images ({images.length})</p>
                <div className="grid grid-cols-2 gap-2">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Preview ${i + 1}`}
                      className="w-full h-32 object-cover rounded-xl border border-gray-200 dark:border-gray-700"
                    />
                  ))}
                </div>
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
          Attach Images <span className="text-gray-400 font-normal">(optional · multiple allowed)</span>
        </label>

        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                <img
                  src={img}
                  alt={`Preview ${idx + 1}`}
                  className="w-full h-32 object-cover"
                />
                
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingImageIndex(idx)}
                    className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-colors"
                    title="Edit/Draw"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleImageChange}
            className="hidden"
            id="issue-image"
            multiple={false}
          />
          <label
            htmlFor="issue-image"
            className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/5 transition-all group text-center"
          >
            <svg className="w-6 h-6 text-gray-400 group-hover:text-purple-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <span className="text-xs text-gray-500 font-medium">Upload File</span>
          </label>
          
          <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all group text-center">
            <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
            <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            <span className="text-xs text-gray-500 font-medium">Take Photo</span>
          </label>
        </div>

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
      
      {editingImageIndex !== null && (
        <ImageEditor
          imageUrl={images[editingImageIndex]}
          onSave={handleEditorSave}
          onCancel={() => setEditingImageIndex(null)}
        />
      )}
    </form>
  );
}
