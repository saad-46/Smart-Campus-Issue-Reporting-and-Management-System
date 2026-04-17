"use client";

import React, { useState, useRef } from "react";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";

interface BillSubmissionFormProps {
  issueId: string;
  issueTitle: string;
  onSuccess: (data: { amount: number; description: string; receiptUrl: string }) => Promise<void>;
  onCancel: () => void;
  onSkip: () => void;
}

export default function BillSubmissionForm({ issueId, issueTitle, onSuccess, onCancel, onSkip }: BillSubmissionFormProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    console.log("Submitting claim...", { issueId, amount, description, hasImage: !!image });

    setIsSubmitting(true);
    try {
      // Store base64 image directly — no Firebase Storage needed
      const receiptUrl = image || "";

      await onSuccess({
        amount: parseFloat(amount),
        description: description.trim(),
        receiptUrl,
      });

      console.log("✅ Claim submitted successfully!");
      setSuccess(true);
    } catch (err: unknown) {
      console.error("❌ Claim submission failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to submit claim. Please try again.";
      setError(msg);
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col items-center justify-center p-12 text-center min-h-[400px]">
        <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Claim Submitted!</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Your expense claim has been sent for admin review.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden flex flex-col animate-in slide-in-from-bottom-6 duration-500">
      {/* Header */}
      <div className="relative h-24 bg-gradient-to-br from-indigo-600 to-purple-700 p-6 flex flex-col justify-end shrink-0">
        <div className="absolute top-2 right-4 text-white/10">
          <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-white relative z-10">Submit Expense Claim</h3>
        <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest relative z-10 truncate">{issueTitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
        {/* Amount */}
        <Input
          label="Expense Amount (INR) *"
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          icon={<span className="font-bold text-gray-500">₹</span>}
        />

        {/* Description */}
        <Textarea
          label="What was this spent on?"
          placeholder="Describe the materials or parts purchased..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        {/* Receipt image — optional */}
        <div className="space-y-2">
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">
            Receipt Photo <span className="text-gray-400 font-normal normal-case">(optional)</span>
          </label>

          {image ? (
            <div className="relative group rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-white/10 aspect-[4/3] bg-black/5 flex items-center justify-center shadow-inner">
              <img src={image} alt="Receipt preview" className="w-full h-full object-contain" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-xl transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 h-28">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all group"
              >
                <svg className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 mb-1.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-black uppercase text-gray-500">Upload File</span>
              </button>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/10 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/5 transition-all group"
              >
                <svg className="w-6 h-6 text-gray-400 group-hover:text-purple-500 mb-1.5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[10px] font-black uppercase text-gray-500">Take Photo</span>
              </button>
            </div>
          )}

          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
          <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs font-bold text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 shadow-xl shadow-indigo-500/20"
          >
            {isSubmitting ? "Submitting…" : "Submit Claim"}
          </Button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSkip}
              disabled={isSubmitting}
              className="flex-1 py-2.5 text-[10px] font-black text-gray-500 hover:text-slate-900 dark:hover:text-white uppercase tracking-tighter transition-colors disabled:opacity-40"
            >
              Skip Expenses
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 py-2.5 text-[10px] font-black text-red-500/70 hover:text-red-500 uppercase tracking-tighter transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
