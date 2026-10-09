"use client";

import React, { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, FlaskConical, Sparkles } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import Button, { buttonClasses } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import Panel from "@/components/issue/Panel";
import { ViewerGate, ViewerLoading, ReadyViewer } from "@/components/viewer/parts";
import { IssuePhoto } from "@/components/viewer/DemoImage";
import { analyzeIssueDetails } from "@/services/aiService";
import { findDuplicates } from "@/lib/intelligence/similarity";
import { DEMO_LOCATIONS, DemoIssue, demoLocation } from "@/lib/viewer/demoData";
import CampusMap from "@/components/admin/CampusMap";
import { VERIFICATION_TONE } from "@/components/viewer/verification";
import { VERIFICATION_LABELS, getBuilding, getCanonicalLocation, institutionName } from "@/lib/campus";
import { ISSUE_CATEGORIES, LIMITS, PRIORITIES, departmentFor } from "@/lib/constants";
import { Priority } from "@/types";

const CAMPUS_NAME = "SUES campus, Mount Pleasant";

function ReportForm({ viewer }: { viewer: ReadyViewer }) {
  const params = useSearchParams();
  // A QR code carries only a stable location id; anything unknown or retired is refused, never guessed.
  const requested = params.get("location") ?? "";
  const known = getCanonicalLocation(requested);
  const initialLocation = demoLocation(requested) && known?.isActive ? requested : "";
  const unknownQr = requested !== "" && initialLocation === "";
  const [landmark, setLandmark] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationId, setLocationId] = useState(initialLocation);
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [photo, setPhoto] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string; location?: string }>({});
  const [created, setCreated] = useState<DemoIssue | null>(null);

  const place = demoLocation(locationId);
  const analysis = useMemo(
    () => (title.trim().length >= 4 || description.trim().length >= 10 ? analyzeIssueDetails({ title, description, location: place?.name ?? "" }) : null),
    [title, description, place]
  );
  const duplicates = useMemo(
    () =>
      title.trim().length >= 6
        ? findDuplicates({ title, category: category || analysis?.category || "General", location: place?.name ?? "", locationId }, viewer.data.issues, viewer.data.now)
        : [],
    [title, category, analysis, place, locationId, viewer.data]
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (title.trim().length < 5) next.title = "Give the problem a short title (at least 5 characters).";
    if (description.trim().length < 10) next.description = "Describe what is wrong (at least 10 characters).";
    if (!locationId) next.location = "Choose where the problem is.";
    setErrors(next);
    if (Object.keys(next).length) return;
    const detail = landmark.trim() ? `${description.trim()}\n\nWhere exactly: ${landmark.trim()}` : description;
    const issue = viewer.createIssue({ title, description: detail, locationId, category: category || undefined, priority: (priority || undefined) as Priority | undefined, withPhoto: photo });
    if (issue) setCreated(issue);
  };

  if (created) {
    return (
      <Card className="mx-auto max-w-xl p-6 text-center sm:p-8" role="status">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-success-border bg-success-subtle text-success">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-fg">Demo report submitted</h2>
        <p className="mt-1 text-sm text-fg-muted">
          {created.id} was added to this demo only: it appears in your issues, the issues table and the administrator&apos;s figures until you leave. Nothing was saved.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          <StatusBadge status={created.status} />
          <PriorityBadge priority={created.priority} />
          <Badge>{created.category}</Badge>
        </div>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Link href={`/viewer/issues/${created.id}`} className={buttonClasses("primary")}>
            Open {created.id}
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              setCreated(null);
              setTitle("");
              setDescription("");
              setCategory("");
              setPriority("");
              setPhoto(false);
            }}
          >
            Report another
          </Button>
        </div>
      </Card>
    );
  }

  const shownCategory = category || analysis?.category;
  const shownPriority = (priority || analysis?.priority) as Priority | undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <form onSubmit={submit} noValidate data-tour="report-form">
        <Card className="space-y-4 p-4 sm:p-5">
          <Notice tone="info">
            <span className="flex items-start gap-2">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Demo mode: submitting adds a sample report to this visit only.
            </span>
          </Notice>
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={LIMITS.title} placeholder="e.g. Projector not turning on" required />
          <Textarea label="What is wrong?" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} rows={4} maxLength={LIMITS.description} placeholder="What you saw, since when, and how it affects people." required />
          {unknownQr && (
            <Notice tone="warning" title="That QR code isn't recognised">
              The link points to a location that isn&apos;t in the campus list (or has been retired). Choose the place below instead.
            </Notice>
          )}
          <Select label="Location" value={locationId} onChange={(e) => setLocationId(e.target.value)} error={errors.location} required hint="Scanning a location's QR code fills this in. You can also pick the place on the map.">
            <option value="">Choose a place…</option>
            {DEMO_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
          {place && (
            <div className="rounded-lg border border-border bg-surface-2/60 p-3 text-[13px] text-fg-muted" data-testid="location-detail">
              <p className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-fg">{place.name}</span>
                <Badge tone={VERIFICATION_TONE[place.verificationStatus]}>{VERIFICATION_LABELS[place.verificationStatus]}</Badge>
              </p>
              <p className="mt-1">
                {CAMPUS_NAME} · {institutionName(place.institutionId) ?? "Campus"}
                {getBuilding(place.buildingId)
                  ? ` · on the map at ${getBuilding(place.buildingId)!.name} (about ${getBuilding(place.buildingId)!.latitude.toFixed(4)}, ${getBuilding(place.buildingId)!.longitude.toFixed(4)})`
                  : " · its position on campus isn't known, so it won't appear on the map"}
              </p>
            </div>
          )}
          <div>
            <Button variant="secondary" size="sm" aria-expanded={mapOpen} onClick={() => setMapOpen((o) => !o)}>
              {mapOpen ? "Hide the map" : "Pick on the map"}
            </Button>
            {mapOpen && (
              <div className="mt-3">
                <CampusMap
                  hotspots={viewer.stats.map.buildings}
                  unplaced={0}
                  selectedId={place?.buildingId || null}
                  onSelect={(id) => {
                    const first = DEMO_LOCATIONS.find((l) => l.buildingId === id);
                    if (first) setLocationId(first.id);
                  }}
                />
                <p className="mt-1 text-xs text-fg-subtle">Selecting a marker chooses the first location at that place; refine it in the list above.</p>
              </div>
            )}
          </div>
          <Input
            label="Where exactly? (optional)"
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            maxLength={120}
            placeholder="e.g. second floor, near the staircase"
            hint="Your own description. Floors and rooms aren't listed because no public source documents them."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} hint={analysis ? `Suggested: ${analysis.category}` : "Suggested as you type"}>
              <option value="">Use the suggestion</option>
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} hint={analysis ? `Suggested: ${analysis.priority}` : "Suggested as you type"}>
              <option value="">Use the suggestion</option>
              {PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-surface-hover">
            <input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} className="mt-0.5 accent-[var(--brand)]" />
            <span>
              <span className="block font-medium text-fg">Attach a sample photo</span>
              <span className="block text-[13px] text-fg-subtle">Real reports take up to three photos. The demo attaches a generated illustration instead.</span>
            </span>
          </label>
          {photo && (
            <div className="aspect-[16/7] overflow-hidden rounded-lg border border-border">
              <IssuePhoto category={shownCategory ?? "General"} seed={title || "preview"} alt="Sample illustration that will be attached to this demo report" />
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Link href="/viewer/student" className={buttonClasses("secondary")}>
              Cancel
            </Link>
            <Button type="submit">Submit report (demo)</Button>
          </div>
        </Card>
      </form>

      <aside className="space-y-6" data-tour="report-ai" aria-label="Suggestions">
        <Panel title="Suggestions" badge={<Badge tone="info" icon={<Sparkles aria-hidden="true" />}>Rule-based</Badge>} description="Updates as you type. You can override it.">
          {analysis ? (
            <div aria-live="polite" className="space-y-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge>{shownCategory}</Badge>
                {shownPriority && <PriorityBadge priority={shownPriority} />}
              </div>
              <p className="text-fg-muted">{analysis.explanation}</p>
              <p className="text-[13px] text-fg-subtle">
                Suggested team: {departmentFor(shownCategory ?? "General")} · confidence {Math.round(analysis.confidence * 100)}% (heuristic)
              </p>
              {analysis.summary && <p className="rounded-md bg-surface-2 p-2 text-[13px] text-fg-muted">Summary: {analysis.summary}</p>}
            </div>
          ) : (
            <p className="text-[13px] text-fg-subtle">Start typing a title and description to see a suggested category, priority and team, with the reason.</p>
          )}
        </Panel>

        <Panel title="Similar open reports" description="Check before submitting. Upvote instead of reporting twice.">
          {duplicates.length === 0 ? (
            <p className="text-[13px] text-fg-subtle">{title.trim().length >= 6 ? "No similar open report found." : "Type a title to look for similar reports from the last 14 days."}</p>
          ) : (
            <ul className="divide-y divide-border" aria-live="polite">
              {duplicates.map((d) => (
                <li key={d.issue.id} className="py-2">
                  <Link href={`/viewer/issues/${d.issue.id}`} className="text-sm font-medium text-fg hover:text-brand-fg">
                    {d.issue.title}
                  </Link>
                  <p className="mt-0.5 text-[13px] text-fg-subtle">
                    {d.issue.location} · {Math.round(d.score * 100)}% similar
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </aside>
    </div>
  );
}

function ReportInner() {
  return (
    <>
      <PageHeader title="Report an issue" description="Tell the campus team what needs fixing. Suggestions appear as you type." />
      <ViewerGate>{(viewer) => <ReportForm viewer={viewer} />}</ViewerGate>
    </>
  );
}

export default function ViewerReportPage() {
  return (
    <Suspense fallback={<ViewerLoading />}>
      <ReportInner />
    </Suspense>
  );
}
