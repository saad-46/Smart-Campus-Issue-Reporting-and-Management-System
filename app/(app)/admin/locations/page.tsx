"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { Download, MapPin, Plus, Printer, QrCode, Search as SearchIcon, Trash2 } from "lucide-react";
import { CampusLocation } from "@/types";
import { createCampusLocation, deleteCampusLocation, qrReportUrl } from "@/lib/locations";
import { BUILDINGS, describeLocation, getBuilding } from "@/lib/campus";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useCampusLocations } from "@/hooks/useCampusLocations";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button, { buttonClasses } from "@/components/ui/Button";
import Dialog, { ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice, Skeleton, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";

/** Generates (and caches per URL) a QR code image in the browser. */
function useQr(url: string, width: number) {
  const [dataUrl, setDataUrl] = useState("");
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setDataUrl("");
    QRCode.toDataURL(url, { width, margin: 2, errorCorrectionLevel: "M" })
      .then((d) => {
        if (!cancelled) setDataUrl(d);
      })
      .catch((err) => logError("QRCode.toDataURL", err));
    return () => {
      cancelled = true;
    };
  }, [url, width]);
  return dataUrl;
}

function QrThumb({ url, className }: { url: string; className?: string }) {
  const dataUrl = useQr(url, 160);
  return dataUrl ? <img src={dataUrl} alt="" className={cn("rounded border border-border bg-white", className)} /> : <Skeleton className={className} />;
}

function QrDialog({ location, origin, onClose }: { location: CampusLocation | null; origin: string; onClose: () => void }) {
  const url = location ? qrReportUrl(origin, location.id) : "";
  const dataUrl = useQr(url, 512);
  const [printing, setPrinting] = useState(false);
  const label = location ? describeLocation(location) : "";

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener("afterprint", done);
    window.print();
    return () => window.removeEventListener("afterprint", done);
  }, [printing]);

  return (
    <Dialog
      open={!!location}
      onClose={onClose}
      title="Location QR code"
      description="Print it and place it at the location. Scanning opens the report form with the location filled in."
      size="sm"
      footer={
        <>
          <a href={dataUrl || undefined} download={location ? `qr-${location.id}.png` : undefined} aria-disabled={!dataUrl} className={buttonClasses("secondary", "md", !dataUrl ? "pointer-events-none opacity-50" : undefined)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Download PNG
          </a>
          <Button icon={<Printer className="h-4 w-4" aria-hidden="true" />} onClick={() => setPrinting(true)} disabled={!dataUrl}>
            Print
          </Button>
        </>
      }
    >
      {location && (
        <div className="flex flex-col items-center text-center">
          <div className="rounded-lg border border-border bg-white p-3">
            {dataUrl ? <img src={dataUrl} alt={`QR code for reporting an issue at ${label}`} className="h-52 w-52" /> : <Skeleton className="h-52 w-52" />}
          </div>
          <p className="mt-4 text-sm font-medium text-fg">{label}</p>
          <p className="mt-0.5 text-[13px] text-fg-subtle">Scan to report an issue here.</p>
          <p className="mt-3 max-w-full break-all rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-subtle">{url}</p>
        </div>
      )}
      {/* Portalled to <body>: inside the dialog, its (animated) panel would become the containing
          block for position:fixed, shrinking and clipping the printed sheet to the dialog's box. */}
      {printing &&
        dataUrl &&
        createPortal(
          <div className="print-area hidden flex-col items-center justify-center p-8 text-center print:flex">
            <img src={dataUrl} alt="" style={{ width: "10cm", height: "10cm" }} />
            <p style={{ fontSize: "20pt", fontWeight: 700, marginTop: "0.5cm" }}>Report a problem here</p>
            <p style={{ fontSize: "14pt", marginTop: "0.2cm" }}>{label}</p>
            <p style={{ fontSize: "9pt", marginTop: "0.4cm", color: "#555" }}>Scan with your phone camera and sign in to UniFix.</p>
          </div>,
          document.body
        )}
    </Dialog>
  );
}

export default function AdminLocationsPage() {
  const { locations, error, reload } = useCampusLocations();
  const toast = useToast();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const [query, setQuery] = useState("");
  const [qrFor, setQrFor] = useState<CampusLocation | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", buildingId: "", floor: "", room: "" });
  const [nameTouched, setNameTouched] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [deleting, setDeleting] = useState<CampusLocation | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (locations ?? []).filter((l) => !q || describeLocation(l).toLowerCase().includes(q));
  }, [locations, query]);

  const nameError = !form.name.trim() ? "Give the location a name." : "";

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setNameTouched(true);
    if (nameError) return;
    setCreating(true);
    setCreateError("");
    try {
      const loc = await createCampusLocation(form);
      toast.success("Location saved", describeLocation(loc));
      setForm({ name: "", buildingId: form.buildingId, floor: "", room: "" });
      setNameTouched(false);
      setAddOpen(false);
      await reload();
      setQrFor(loc);
    } catch (err) {
      logError("createCampusLocation", err);
      setCreateError(getFriendlyErrorMessage(err, "The location couldn't be added."));
    } finally {
      setCreating(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusyDelete(true);
    try {
      await deleteCampusLocation(deleting.id);
      toast.success("Location deleted");
      await reload();
    } catch (err) {
      logError("deleteCampusLocation", err);
      toast.error("Couldn't delete the location", getFriendlyErrorMessage(err, "Please try again."));
    } finally {
      setBusyDelete(false);
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Locations & QR codes"
        description="Reportable places on campus. Each has a QR code that opens the report form with the location filled in."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
            Add location
          </Button>
        }
      />

      {origin && (
        <Notice tone="info" className="mb-6">
          QR codes link to <span className="font-mono text-[13px]">{origin}</span>. Generate them from the production site before printing.
        </Notice>
      )}

      <Card>
        <div className="border-b border-border p-3 sm:p-4">
          <Input type="search" aria-label="Filter locations" placeholder="Filter locations" icon={<SearchIcon aria-hidden="true" />} value={query} onChange={(e) => setQuery(e.target.value)} wrapperClassName="sm:max-w-xs" />
        </div>
        {error ? (
          <ErrorState compact title="Locations couldn't be loaded" onRetry={() => void reload()} />
        ) : locations === null ? (
          <SkeletonRows rows={4} />
        ) : locations.length === 0 ? (
          <EmptyState
            icon={<QrCode />}
            title="No locations yet"
            description="Add a lab, washroom or classroom to generate its QR code."
            action={
              <Button size="sm" icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
                Add location
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState compact title={`No locations match “${query.trim()}”`} />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((loc) => (
              <li key={loc.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover sm:px-5">
                {origin && <QrThumb url={qrReportUrl(origin, loc.id)} className="h-12 w-12 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{loc.name}</p>
                  <p className="flex items-center gap-1 truncate text-[13px] text-fg-subtle">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {[getBuilding(loc.buildingId)?.name ?? "Not placed on the map", loc.floor && `Floor ${loc.floor}`, loc.room && `Room ${loc.room}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="secondary" icon={<QrCode className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`QR code for ${describeLocation(loc)}`} onClick={() => setQrFor(loc)}>
                    <span className="hidden sm:inline">QR code</span>
                    <span className="sm:hidden">QR</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${describeLocation(loc)}`}
                    onClick={() => setDeleting(loc)}
                    className="px-2 text-fg-subtle hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        dismissible={!creating}
        title="Add location"
        description="Its QR code is generated as soon as it's saved."
        initialFocus={nameInputRef}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" form="add-location-form" isLoading={creating}>
              Save location
            </Button>
          </>
        }
      >
        <form id="add-location-form" onSubmit={create} noValidate className="space-y-4">
          <Input
            label="Name"
            placeholder="e.g. Physics Lab"
            maxLength={80}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => setNameTouched(true)}
            error={nameTouched && nameError ? nameError : undefined}
            ref={nameInputRef}
            required
          />
          <Select label="Map place" hint="Places the location on the campus map. Leave empty when its position isn't known." value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })}>
            <option value="">Not on the map</option>
            {BUILDINGS.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Floor" aside="Optional" maxLength={10} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
            <Input label="Room" aside="Optional" maxLength={20} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>
          {createError && <Notice tone="danger">{createError}</Notice>}
        </form>
      </Dialog>

      <QrDialog location={qrFor} origin={origin} onClose={() => setQrFor(null)} />

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting ? describeLocation(deleting) : ""}”?`}
        description="Printed QR codes for it will stop filling in the location. Existing reports are not affected."
        confirmLabel="Delete location"
        tone="danger"
        busy={busyDelete}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
