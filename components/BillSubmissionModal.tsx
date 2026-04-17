"use client";

import React, { useState, useRef } from "react";
import { uploadImage } from "@/services/storageService";
import Button from "./ui/Button";
import Input from "./ui/Input";
import Textarea from "./ui/Textarea";

interface BillSubmissionModalProps {
  issueId: string;
  onSuccess: (data: { amount: number; description: string; receiptUrl: string }) => Promise<void>;
  onCancel: () => void;
  onSkip: () => void;
}

export default function BillSubmissionModal({ issueId, onSuccess, onCancel, onSkip }: BillSubmissionModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount))) {
      setError("Please enter a valid amount");
      return;
    }
    if (!image) {
      setError("Please provide a photo of the bill/receipt");
      return;
    }

    setIsUploading(true);
    setError("");
    try {
      const file = dataURLtoFile(image, `receipt-${issueId}.jpg`);
      const receiptUrl = await uploadImage(file, "receipts");
      await onSuccess({
        amount: parseFloat(amount),
        description,
        receiptUrl
      });
    } catch (err: any) {
      setError(err.message || "Failed to submit bill");
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl max-w-md w-full border border-white/10 overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
        {/* Header */}
        <div className="relative h-32 bg-gradient-to-br from-indigo-600 to-purple-700 p-8 flex flex-col justify-end">
          <div className="absolute top-4 right-4 text-white/20">
            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </div>
          <h3 className="text-2xl font-black text-white relative z-10">Submit Expense</h3>
          <p className="text-indigo-100 text-sm font-medium relative z-10">Ticket #{issueId.substring(0, 8)}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-4">
            <Input
              label="Expense Amount (INR)"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              icon={<span className="font-bold text-gray-400">₹</span>}
            />

            <Textarea
              label="Optional Description"
              placeholder="What was this expense for? (e.g., Replacement pipe, wiring)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />

            <div className="space-y-2">
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Bill Proof (Mandatory)</label>
              
              {image ? (
                <div className="relative group rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 aspect-video bg-black/5 flex items-center justify-center">
                  <img src={image} alt="Receipt preview" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button 
                      type="button" 
                      onClick={() => setImage(null)}
                      className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-xl transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 h-32">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/5 transition-all group"
                  >
                    <svg className="w-8 h-8 text-gray-400 group-hover:text-indigo-500 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <span className="text-[10px] font-black uppercase text-gray-500">Upload File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/5 transition-all group"
                  >
                    <svg className="w-8 h-8 text-gray-400 group-hover:text-purple-500 mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <span className="text-[10px] font-black uppercase text-gray-500">Take Photo</span>
                  </button>
                </div>
              )}
              
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl text-xs font-bold text-red-500 animate-in shake-in duration-300">
              ⚠️ {error}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4">
            <Button type="submit" variant="primary" size="lg" isLoading={isUploading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 shadow-xl shadow-indigo-500/20">
              Verify & Submit Bill
            </Button>
            <div className="flex gap-3">
              <button 
                type="button" 
                onClick={onSkip}
                disabled={isUploading}
                className="flex-1 py-3 text-xs font-black text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Skip / No Expenses
              </button>
              <button 
                type="button" 
                onClick={onCancel}
                disabled={isUploading}
                className="flex-1 py-3 text-xs font-black text-red-500/70 hover:text-red-500 transition-colors"
              >
                Cancel Action
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
