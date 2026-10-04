"use client";

import React, { useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import Button from "./ui/Button";
import Dialog from "./ui/Dialog";
import { Input, Textarea } from "./ui/Field";
import { Notice } from "./ui/States";
import { LIMITS } from "@/lib/constants";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { fileToCompressedDataUrl } from "@/lib/image";
import { parseAmount } from "@/lib/validation";
import { cn } from "@/lib/cn";

interface ResolveDialogProps {
  open: boolean;
  issueId: string;
  issueTitle: string;
  /** Resolve and file an expense claim. */
  onSuccess: (data: { amount: number; description: string; receiptUrl: string }) => Promise<void>;
  /** Resolve without a claim. */
  onSkip: () => Promise<void>;
  onCancel: () => void;
}

/**
 * Resolving a task: optionally attach an expense claim (amount + receipt)
 * for administrator review, or resolve without one.
 */
export default function BillSubmissionForm({ open, issueId, issueTitle, onSuccess, onSkip, onCancel }: ResolveDialogProps) {
  const [withClaim, setWithClaim] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState<"claim" | "skip" | null>(null);
  const [error, setError] = useState("");
  const [amountTouched, setAmountTouched] = useState(false);

  let amountError = "";
  try {
    if (withClaim) parseAmount(amount, LIMITS.maxClaimAmount);
  } catch (err) {
    amountError = getFriendlyErrorMessage(err);
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setError("");
    try {
      setImage(await fileToCompressedDataUrl(file, LIMITS.receiptChars));
    } catch (err) {
      setError(getFriendlyErrorMessage(err, "Couldn't add that image. Please try another."));
    }
  };

  const submit = async () => {
    setError("");
    if (!withClaim) {
      setBusy("skip");
      try {
        await onSkip();
      } catch (err) {
        logError(`resolve:${issueId}`, err);
        setError(getFriendlyErrorMessage(err, "Couldn't resolve this task. Please try again."));
        setBusy(null);
      }
      return;
    }
    setAmountTouched(true);
    let claimAmount: number;
    try {
      claimAmount = parseAmount(amount, LIMITS.maxClaimAmount);
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
      return;
    }
    setBusy("claim");
    try {
      await onSuccess({ amount: claimAmount, description: description.trim(), receiptUrl: image || "" });
    } catch (err: unknown) {
      logError(`submitBill:${issueId}`, err);
      setError(getFriendlyErrorMessage(err, "Failed to submit claim. Please try again."));
      setBusy(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      dismissible={busy === null}
      title="Resolve task"
      description={issueTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy !== null}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={busy !== null}>
            {withClaim ? "Resolve and submit claim" : "Mark as resolved"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-fg-muted">The reporter will be notified and asked to rate the fix. This can&apos;t be undone.</p>

        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Did you spend money on parts or materials?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: false, label: "No expenses" },
              { value: true, label: "Add a claim" },
            ].map((o) => (
              <label
                key={String(o.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                  withClaim === o.value ? "border-brand bg-brand-subtle text-fg ring-1 ring-brand" : "border-border text-fg-muted hover:border-border-strong"
                )}
              >
                <input type="radio" name="claim" checked={withClaim === o.value} onChange={() => setWithClaim(o.value)} className="accent-[var(--brand)]" />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        {withClaim && (
          <div className="space-y-4 rounded-md border border-border bg-surface-2/50 p-3 animate-fade-in">
            <Input
              label="Amount"
              type="number"
              min="0.01"
              max={LIMITS.maxClaimAmount}
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => setAmountTouched(true)}
              error={amountTouched && amountError ? amountError : undefined}
              icon={<span className="text-sm font-medium">₹</span>}
              required
            />
            <Textarea
              label="What was it spent on?"
              aside="Optional"
              hint="Shown to administrators when they review the claim."
              placeholder="e.g. Replacement tap cartridge"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={LIMITS.claimDescription}
              rows={2}
            />
            <div>
              <p className="mb-1.5 text-sm font-medium text-fg">
                Receipt photo <span className="font-normal text-fg-subtle">· optional, visible only to administrators</span>
              </p>
              {image ? (
                <div className="relative overflow-hidden rounded-md border border-border bg-surface">
                  <img src={image} alt="Receipt preview" className="max-h-56 w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setImage(null)}
                    aria-label="Remove receipt photo"
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-surface/90 text-fg shadow-xs hover:text-danger"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 text-sm font-medium text-fg transition-colors hover:border-brand hover:bg-brand-subtle focus-within:outline-2 focus-within:outline-brand">
                    <ImagePlus className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Upload receipt
                    <input type="file" onChange={handleFileChange} accept="image/jpeg,image/png,image/webp" className="sr-only" />
                  </label>
                  <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3 text-sm font-medium text-fg transition-colors hover:border-brand hover:bg-brand-subtle focus-within:outline-2 focus-within:outline-brand sm:hidden">
                    <Camera className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Take photo
                    <input type="file" onChange={handleFileChange} accept="image/*" capture="environment" className="sr-only" />
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Dialog>
  );
}
