"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, MapPin, Pencil, QrCode, X } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { createIssue } from "@/lib/firestore";
import { analyzeIssueDetails, IssueIntelligence } from "@/services/aiService";
import { CampusLocation } from "@/types";
import { DEFAULT_CATEGORY, DEFAULT_PRIORITY, LIMITS, departmentFor } from "@/lib/constants";
import { CAMPUS_LOCATIONS, VERIFICATION_LABELS, describeLocation, getCanonicalLocation, institutionName } from "@/lib/campus";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { compressDataUrl, fileToCompressedDataUrl, makeThumbnail } from "@/lib/image";
import { cleanText } from "@/lib/validation";
import { Input, Select, Textarea } from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import { Notice } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import AnalysisSummary from "@/components/report/AnalysisSummary";
import DuplicateCheck from "@/components/report/DuplicateCheck";
import ImageEditor from "@/components/ImageEditor";
import { useSlowNotice } from "@/hooks/useSlowNotice";
import { cn } from "@/lib/cn";

interface IssueFormProps {
  /** Called after the issue is saved. Defaults to opening the new issue. */
  onIssueCreated?: (issueId: string) => void;
  /** Place scanned from a location QR code. */
  locationPreset?: CampusLocation | null;
}

const FALLBACK: IssueIntelligence = {
  category: DEFAULT_CATEGORY,
  priority: DEFAULT_PRIORITY,
  confidence: 0,
  explanation: "",
  summary: "",
  department: departmentFor(DEFAULT_CATEGORY),
};

function Section({ step, title, description, children }: { step: number; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-border px-4 py-5 last:border-b-0 sm:px-5 md:grid-cols-[11rem_1fr] md:gap-6">
      <div>
        <p className="tabular text-xs font-medium text-fg-subtle">Step {step}</p>
        <h2 className="mt-0.5 text-sm font-semibold text-fg">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-fg-subtle">{description}</p>}
      </div>
      <div className="min-w-0 space-y-4">{children}</div>
    </section>
  );
}

export default function IssueForm({ onIssueCreated, locationPreset = null }: IssueFormProps) {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(locationPreset ? describeLocation(locationPreset) : "");
  const [locationId, setLocationId] = useState(locationPreset?.id ?? "");
  const [duplicateOf, setDuplicateOf] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [imageError, setImageError] = useState("");
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({ title: false, description: false, location: false });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canAddImage = images.length < LIMITS.maxImages;
  const submitIsSlow = useSlowNotice(isSubmitting);

  // ── Live suggestion (deterministic and cheap; deferred while typing) ──
  const deferredText = useDeferredValue(`${title}\u0000${description}\u0000${location}`);
  const { analysis, unavailable } = useMemo(() => {
    const [t, d, l] = deferredText.split("\u0000");
    if (cleanText(`${t} ${d}`).length < 6) return { analysis: null, unavailable: false };
    try {
      return { analysis: analyzeIssueDetails({ title: t, description: d, location: l }), unavailable: false };
    } catch (err) {
      // Categorisation is a convenience — never let it block a report.
      logError("analyzeIssueDetails", err);
      return { analysis: FALLBACK, unavailable: true };
    }
  }, [deferredText]);

  // ── Validation (shown after a field is left, or on submit) ──
  const errors = {
    title: !cleanText(title) ? "Give the issue a short title." : "",
    description: !cleanText(description, true) ? "Describe what's wrong." : "",
    location: !cleanText(location) ? "Say where the problem is." : "",
  };
  const show = (field: keyof typeof errors) => (touched[field] || submitted ? errors[field] || undefined : undefined);
  const blur = (field: keyof typeof touched) => () => setTouched((t) => ({ ...t, [field]: true }));

  // ── Photos ──
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError("");
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // allow picking the same file again
    if (!file) return;
    if (!canAddImage) {
      setImageError(`You can attach at most ${LIMITS.maxImages} photos.`);
      return;
    }
    setIsProcessingImage(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, LIMITS.imageChars);
      setImages((prev) => (prev.length < LIMITS.maxImages ? [...prev, dataUrl] : prev));
    } catch (err) {
      setImageError(getFriendlyErrorMessage(err, "Couldn't add that photo. Please try another."));
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleEditorSave = async (editedImage: string) => {
    const index = editingImageIndex;
    setEditingImageIndex(null);
    if (index === null) return;
    try {
      // The editor exports a fresh canvas — re-compress to stay within budget.
      const compressed = await compressDataUrl(editedImage, LIMITS.imageChars);
      setImages((prev) => prev.map((img, i) => (i === index ? compressed : img)));
    } catch (err) {
      setImageError(getFriendlyErrorMessage(err, "Couldn't save your edits to that photo."));
    }
  };

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || isSubmitting) return;
    setSubmitted(true);
    setError("");
    if (errors.title || errors.description || errors.location) return;

    const result = analysis ?? FALLBACK;
    setIsSubmitting(true);
    try {
      // Lists only load a small preview; the full photo is fetched on demand.
      const issueImages = await Promise.all(images.map(async (full) => ({ full, thumb: await makeThumbnail(full) })));
      const issueId = await createIssue(
        { title, description, location },
        userProfile.id,
        userProfile.name,
        result.category,
        result.priority,
        issueImages,
        {
          analysis: analysis && !unavailable ? { summary: analysis.summary, confidence: analysis.confidence, department: analysis.department } : undefined,
          locationId,
          duplicateOf,
        }
      );
      // Only reached once the write has actually succeeded.
      toast.success(duplicateOf ? "Issue submitted and linked" : "Issue submitted", "You'll be notified when its status changes.");
      if (onIssueCreated) onIssueCreated(issueId);
      else router.push(`/issues/${issueId}`);
    } catch (err) {
      logError("createIssue", err);
      setError(getFriendlyErrorMessage(err, "Unable to submit your issue right now. Please try again."));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="min-w-0 space-y-6">
        <div className="rounded-lg border border-border bg-surface">
          <Section step={1} title="What happened?" description="A short title and a few details help staff fix it faster.">
            <Input
              label="Title"
              placeholder="e.g. Broken AC in Lab 204"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={blur("title")}
              error={show("title")}
              maxLength={LIMITS.title}
              required
            />
            <Textarea
              label="Describe the problem"
              placeholder="What's wrong, since when, and anything that would help someone find and fix it."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={blur("description")}
              error={show("description")}
              maxLength={LIMITS.description}
              aside={description.length > LIMITS.description * 0.8 ? `${description.length}/${LIMITS.description}` : undefined}
              rows={5}
              required
            />
          </Section>

          <Section step={2} title="Where?" description="Pick a campus place, then add the floor, room or a landmark if you know it.">
            {locationId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-brand-subtle-border bg-brand-subtle px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <QrCode className="h-4 w-4 shrink-0 text-brand-fg" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{locationPreset ? describeLocation(locationPreset) : location}</p>
                    <p className="text-xs text-fg-subtle">From the QR code you scanned</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLocationId("")}>
                  Change
                </Button>
              </div>
            ) : (
              <>
              <Select
                label="Campus place (optional)"
                value={CAMPUS_LOCATIONS.find((l) => location.startsWith(l.name))?.id ?? ""}
                onChange={(e) => {
                  const chosen = getCanonicalLocation(e.target.value);
                  if (chosen) setLocation(chosen.name);
                }}
                hint={(() => {
                  const chosen = CAMPUS_LOCATIONS.find((l) => location.startsWith(l.name));
                  return chosen
                    ? `${institutionName(chosen.institutionId, true) ?? "SUES campus"} · ${VERIFICATION_LABELS[chosen.verificationStatus]}${chosen.placeId ? "" : " (not shown on the map)"}. Add the floor, room or a landmark below.`
                    : "Pick a known place, then add the floor, room or a landmark below. Or just type the location.";
                })()}
                wrapperClassName="mb-4"
              >
                <option value="">Choose a place…</option>
                {CAMPUS_LOCATIONS.filter((l) => l.isActive).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Location"
                placeholder="e.g. Block 4, 2nd floor, near the staircase"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={blur("location")}
                error={show("location")}
                maxLength={LIMITS.location}
                icon={<MapPin aria-hidden="true" />}
                required
              />
              </>
            )}
          </Section>

          <Section step={3} title="Photos" description={`Optional, up to ${LIMITS.maxImages}. You can draw on a photo to point out the problem.`}>
            {images.length > 0 && (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((img, idx) => (
                  <li key={idx} className="relative aspect-square overflow-hidden rounded-md border border-border bg-surface-2">
                    <img src={img} alt={`Photo ${idx + 1}`} className="h-full w-full object-cover" />
                    <div className="absolute right-1 top-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingImageIndex(idx)}
                        aria-label={`Draw on photo ${idx + 1}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-surface/90 text-fg shadow-xs transition-colors hover:bg-surface"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImages((prev) => prev.filter((_, i) => i !== idx));
                          setImageError("");
                        }}
                        aria-label={`Remove photo ${idx + 1}`}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-surface/90 text-fg shadow-xs transition-colors hover:bg-surface hover:text-danger"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canAddImage && (
              <div className="flex flex-wrap gap-2">
                <label
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:border-brand hover:bg-brand-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                    isProcessingImage && "pointer-events-none opacity-60"
                  )}
                >
                  <ImagePlus className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                  {isProcessingImage ? "Processing…" : "Add photo"}
                  <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} disabled={isProcessingImage} className="sr-only" />
                </label>
                <label
                  className={cn(
                    "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:border-brand hover:bg-brand-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand sm:hidden",
                    isProcessingImage && "pointer-events-none opacity-60"
                  )}
                >
                  <Camera className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                  Take photo
                  <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} disabled={isProcessingImage} className="sr-only" />
                </label>
              </div>
            )}
            {imageError && (
              <p role="alert" className="text-[13px] text-danger">
                {imageError}
              </p>
            )}
          </Section>
        </div>

        <DuplicateCheck candidate={{ title, category: analysis?.category ?? DEFAULT_CATEGORY, location, locationId }} value={duplicateOf} onChange={setDuplicateOf} />

        {/* Suggestion appears inline on smaller screens. */}
        <AnalysisSummary analysis={analysis} unavailable={unavailable} empty={!analysis} className="lg:hidden" />

        {error && <Notice tone="danger" title="Couldn't submit">{error}</Notice>}
        {submitIsSlow && (
          <Notice tone="warning" title="Still trying to reach the server">
            Your issue hasn&apos;t been saved yet — keep this page open and it will be submitted as soon as the connection returns.
          </Notice>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-2 border-t border-border bg-canvas px-4 py-3 shadow-[0_-4px_12px_hsl(var(--shadow-color)/0.06)] sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <p className="hidden text-[13px] text-fg-subtle sm:block">You&apos;ll get a notification at every status change.</p>
          <Button type="submit" size="lg" isLoading={isSubmitting} disabled={isProcessingImage} className="w-full sm:w-auto">
            {duplicateOf ? "Submit and link report" : "Submit issue"}
          </Button>
        </div>
      </div>

      <aside className="sticky top-20 hidden lg:block">
        <AnalysisSummary analysis={analysis} unavailable={unavailable} empty={!analysis} />
      </aside>

      {editingImageIndex !== null && (
        <ImageEditor imageUrl={images[editingImageIndex]} onSave={handleEditorSave} onCancel={() => setEditingImageIndex(null)} />
      )}
    </form>
  );
}
