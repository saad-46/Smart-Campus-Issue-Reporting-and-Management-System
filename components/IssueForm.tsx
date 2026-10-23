"use client";

import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, MapPin, Pencil, X } from "lucide-react";
import { useAuthContext } from "@/components/AuthProvider";
import { createIssue } from "@/lib/firestore";
import { analyzeIssueDetails, IssueIntelligence } from "@/services/aiService";
import { DEFAULT_CATEGORY, DEFAULT_PRIORITY, LIMITS, departmentFor } from "@/lib/constants";
import { CAMPUS_LOCATIONS, VERIFICATION_LABELS, describeLocation, getBuilding, getCanonicalLocation, institutionName } from "@/lib/campus";
import CampusMap from "@/components/admin/CampusMap";
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
import CameraCapture from "@/components/CameraCapture";
import { CameraSupport, detectCameraSupport } from "@/lib/camera";
import { useSlowNotice } from "@/hooks/useSlowNotice";
import { useCampusLocations } from "@/hooks/useCampusLocations";
import { cn } from "@/lib/cn";

interface IssueFormProps {
  /** Called after the issue is saved. Defaults to opening the new issue. */
  onIssueCreated?: (issueId: string) => void;
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

export default function IssueForm({ onIssueCreated }: IssueFormProps) {
  const { userProfile } = useAuthContext();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { locations: managedLocations } = useCampusLocations();
  const [location, setLocation] = useState("");
  // The id of an administrator-managed location, when one was chosen from the list.
  const [locationId, setLocationId] = useState("");
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
  const [camera, setCamera] = useState<CameraSupport>({ live: false, nativeCapture: false });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  // Detected after mount: server and first client render agree, then the right control appears.
  useEffect(() => {
    setCamera(detectCameraSupport({ isSecureContext: window.isSecureContext, mediaDevices: navigator.mediaDevices, coarsePointer: window.matchMedia("(pointer: coarse)").matches }));
  }, []);
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
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = ""; // allow picking the same file again
    if (file) void addFile(file);
  };

  // One path for a chosen file and a captured frame: same checks, same compression.
  const addFile = async (file: File) => {
    setImageError("");
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
            <>
              <Select
                label="Campus place (optional)"
                value={locationId ? `managed:${locationId}` : (CAMPUS_LOCATIONS.find((l) => location.startsWith(l.name))?.id ?? "")}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.startsWith("managed:")) {
                    const managed = (managedLocations ?? []).find((l) => l.id === value.slice("managed:".length));
                    if (managed) {
                      setLocation(describeLocation(managed));
                      setLocationId(managed.id);
                    }
                    return;
                  }
                  const chosen = getCanonicalLocation(value);
                  if (chosen) {
                    setLocation(chosen.name);
                    setLocationId("");
                  }
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
                {managedLocations && managedLocations.length > 0 && (
                  <optgroup label="Added by administrators">
                    {managedLocations.map((l) => (
                      <option key={l.id} value={`managed:${l.id}`}>
                        {describeLocation(l)}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
              <div className="mb-4">
                <Button type="button" variant="secondary" size="sm" aria-expanded={mapOpen} onClick={() => setMapOpen((o) => !o)}>
                  {mapOpen ? "Hide the map" : "Pick on the map"}
                </Button>
                {mapOpen && (
                  <div className="mt-3">
                    <CampusMap
                      hotspots={[]}
                      unplaced={0}
                      selectedId={getCanonicalLocation(CAMPUS_LOCATIONS.find((l) => location.startsWith(l.name))?.id)?.placeId ?? null}
                      onSelect={(id) => {
                        // A building can hold several places (Block 2 and Ghulam Ahmed Hall): prefer the one the marker is named for.
                        const here = CAMPUS_LOCATIONS.filter((l) => l.isActive && l.placeId === id);
                        const buildingName = getBuilding(id)?.name.toLowerCase() ?? "";
                        const first = here.find((l) => buildingName.startsWith(l.name.toLowerCase())) ?? here[0];
                        if (first) {
                          setLocation(first.name);
                          setLocationId("");
                        }
                      }}
                    />
                    <p className="mt-1 text-xs text-fg-subtle">Selecting a marker chooses the first place there; refine it in the list above.</p>
                  </div>
                )}
              </div>
              <Input
                label="Location"
                placeholder="e.g. Block 4, 2nd floor, near the staircase"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  // Typing over a chosen place makes it free text again.
                  setLocationId("");
                }}
                onBlur={blur("location")}
                error={show("location")}
                maxLength={LIMITS.location}
                icon={<MapPin aria-hidden="true" />}
                required
              />
            </>
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
                  <input ref={uploadRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} disabled={isProcessingImage} className="sr-only" />
                </label>
                {camera.nativeCapture && (
                  <label
                    className={cn(
                      "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:border-brand hover:bg-brand-subtle focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                      isProcessingImage && "pointer-events-none opacity-60"
                    )}
                  >
                    <Camera className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                    Take photo
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} disabled={isProcessingImage} className="sr-only" />
                  </label>
                )}
                {camera.live && !camera.nativeCapture && (
                  <button
                    type="button"
                    onClick={() => setCameraOpen(true)}
                    disabled={isProcessingImage}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-dashed border-border-strong bg-surface px-3.5 text-sm font-medium text-fg transition-colors hover:border-brand hover:bg-brand-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-60"
                  >
                    <Camera className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
                    Take photo
                  </button>
                )}
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

      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(file) => void addFile(file)} onUploadInstead={() => uploadRef.current?.click()} />

      {editingImageIndex !== null && (
        <ImageEditor imageUrl={images[editingImageIndex]} onSave={handleEditorSave} onCancel={() => setEditingImageIndex(null)} />
      )}
    </form>
  );
}
