"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Download, Plus, Printer, QrCode } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button, { buttonClasses } from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Field";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ViewerGate, ViewerLoading } from "@/components/viewer/parts";
import { BUILDINGS, VERIFICATION_LABELS, getBuilding, institutionName } from "@/lib/campus";
import Badge from "@/components/ui/Badge";
import { VERIFICATION_TONE } from "@/components/viewer/verification";
import { DemoLocation } from "@/lib/viewer/demoData";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

function useQr(url: string, width: number) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    setDataUrl("");
    setFailed(false);
    QRCode.toDataURL(url, { width, margin: 2, errorCorrectionLevel: "M" })
      .then((d) => !cancelled && setDataUrl(d))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [url, width]);
  return { dataUrl, failed };
}

/** The demo's QR codes open the demo report form, never the signed-in one. */
function reportUrl(origin: string, id: string) {
  return `${origin}/viewer/report?location=${id}`;
}

function QrThumb({ url, label }: { url: string; label: string }) {
  const { dataUrl } = useQr(url, 160);
  return dataUrl ? (
    <img src={dataUrl} alt={`QR code for ${label}`} className="h-14 w-14 shrink-0 rounded-md border border-border bg-white" />
  ) : (
    <Skeleton className="h-14 w-14 shrink-0" />
  );
}

function QrDialog({ location, origin, onClose, onCopy, onDelete }: { location: DemoLocation | null; origin: string; onClose: () => void; onCopy: () => void; onDelete: () => void }) {
  const url = location ? reportUrl(origin, location.id) : "";
  const { dataUrl, failed } = useQr(url, 512);
  const [printing, setPrinting] = useState(false);

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
      description="Print it and place it at the location. Scanning opens the report form with the place filled in."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCopy} icon={<Copy className="h-4 w-4" aria-hidden="true" />}>
            Copy link
          </Button>
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
            {dataUrl ? (
              <img src={dataUrl} alt={`QR code for reporting an issue at ${location.name}`} className="h-52 w-52" />
            ) : failed ? (
              <p className="flex h-52 w-52 items-center justify-center text-sm text-danger">The QR code couldn&apos;t be drawn.</p>
            ) : (
              <Skeleton className="h-52 w-52" />
            )}
          </div>
          <p className="mt-4 text-sm font-medium text-fg">{location.name}</p>
          <p className="mt-0.5 text-[13px] text-fg-subtle">Scan to report an issue here.</p>
          <p className="mt-3 max-w-full break-all rounded bg-surface-2 px-2 py-1 font-mono text-[11px] text-fg-subtle">{url}</p>
          <Link href={`/viewer/report?location=${location.id}`} className="mt-3 text-[13px] font-medium text-brand-fg hover:underline">
            Open the report form as a scan would
          </Link>
          {location.custom && <p className="mt-2 text-xs text-fg-subtle">Added in this demo, so its code works in this tab only, until you leave or reset.</p>}
          {location.custom ? (
            <Button variant="ghost" size="sm" className="mt-3 text-danger hover:text-danger" onClick={onDelete}>
              Delete this location
            </Button>
          ) : (
            <p className="mt-3 text-xs text-fg-subtle">Part of the researched campus dataset, so it can&apos;t be deleted here.</p>
          )}
        </div>
      )}
      {/* Portalled to <body>: inside the dialog, its (animated) panel would become the containing block for position:fixed and clip the printed sheet. */}
      {printing &&
        dataUrl &&
        location &&
        createPortal(
          <div className="print-area hidden flex-col items-center justify-center p-8 text-center print:flex">
            <img src={dataUrl} alt="" style={{ width: "10cm", height: "10cm" }} />
            <p style={{ fontSize: "20pt", fontWeight: 700, marginTop: "0.5cm" }}>Report a problem here</p>
            <p style={{ fontSize: "14pt", marginTop: "0.2cm" }}>{location.name}</p>
            <p style={{ fontSize: "9pt", marginTop: "0.4cm", color: "#555" }}>Scan with your phone camera. (Demo QR code)</p>
          </div>,
          document.body
        )}
    </Dialog>
  );
}

function LocationsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [building, setBuilding] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", buildingId: "", floor: "", room: "" });
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<DemoLocation | null>(null);

  return (
    <ViewerGate>
      {({ demoToast, locations, findLocation, addLocation, deleteLocation }) => {
        const selected = findLocation(params.get("location")) ?? null;
        const rows = locations.filter((l) => (!building || l.buildingId === building) && (!q.trim() || l.name.toLowerCase().includes(q.trim().toLowerCase())));
        const chips: FilterChip[] = building ? [{ key: "b", label: getBuilding(building)?.name ?? building, onRemove: () => setBuilding("") }] : [];
        return (
          <>
            <PageHeader
              title="Locations and QR codes"
              description="Researched SUES campus locations, plus any you add. Each has a QR code that carries only its stable id; scanning it opens the report form with the place filled in."
              actions={
                <Button
                  icon={<Plus className="h-4 w-4" aria-hidden="true" />}
                  onClick={() => {
                    setForm({ name: "", buildingId: "", floor: "", room: "" });
                    setFormError("");
                    setAddOpen(true);
                  }}
                >
                  Add location
                </Button>
              }
            />
            <Card className="mb-4 p-3 sm:p-4">
              <FilterBar search={q} onSearch={setQ} searchLabel="Search locations" placeholder="Search locations" chips={chips} onClear={() => setBuilding("")}>
                <Select size="sm" aria-label="Map place" value={building} onChange={(e) => setBuilding(e.target.value)} wrapperClassName="w-auto">
                  <option value="">All map places</option>
                  {BUILDINGS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </FilterBar>
            </Card>

            {rows.length === 0 ? (
              <Card>
                <EmptyState title="No locations match" description="Try a different search or map place." />
              </Card>
            ) : (
              <ul data-tour="locations-list" aria-label="Locations" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((l) => (
                  <li key={l.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => router.replace(`/viewer/locations?location=${l.id}`)}
                      className={cn("glass lift flex w-full items-center gap-3 rounded-xl p-3 text-left")}
                    >
                      {origin ? <QrThumb url={reportUrl(origin, l.id)} label={l.name} /> : <Skeleton className="h-14 w-14 shrink-0" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{l.name}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[13px] text-fg-subtle">
                          <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="truncate">{institutionName(l.institutionId, true) ?? "Campus"} · {getBuilding(l.buildingId)?.name ?? "not on the map"}</span>
                        </span>
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          <Badge tone={VERIFICATION_TONE[l.verificationStatus]}>{VERIFICATION_LABELS[l.verificationStatus]}</Badge>
                          {l.custom && <Badge tone="info">Added in this demo</Badge>}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <QrDialog
              location={selected}
              origin={origin}
              onClose={() => router.replace("/viewer/locations")}
              onCopy={() => {
                if (selected) void navigator.clipboard?.writeText(reportUrl(origin, selected.id)).catch(() => undefined);
                demoToast("Link copied", "It opens the demo report form.");
              }}
              onDelete={() => setDeleting(selected)}
            />

            <Dialog
              open={addOpen}
              onClose={() => setAddOpen(false)}
              title="Add location"
              description="A place people can report against, with its own QR code. Demo only: it lasts until you leave or reset the demo."
              size="sm"
              footer={
                <>
                  <Button variant="secondary" onClick={() => setAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" form="demo-add-location">
                    Add location (demo)
                  </Button>
                </>
              }
            >
              <form
                id="demo-add-location"
                noValidate
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const result = addLocation(form);
                  setFormError(result.error ?? "");
                  if (result.id) {
                    setAddOpen(false);
                    router.replace(`/viewer/locations?location=${result.id}`);
                  }
                }}
              >
                <Input label="Name" placeholder="e.g. Staff room" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={formError || undefined} required />
                <Select label="Map place" hint="Places the location on the campus map. Leave empty when its position isn't known." value={form.buildingId} onChange={(e) => setForm({ ...form, buildingId: e.target.value })}>
                  <option value="">Not on the map</option>
                  {BUILDINGS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Floor (optional)" maxLength={10} value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                  <Input label="Room (optional)" maxLength={20} value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
                </div>
                <p className="text-xs text-fg-subtle">Floors and rooms you type are your own description; the researched dataset doesn&apos;t list any.</p>
              </form>
            </Dialog>

            <ConfirmDialog
              open={!!deleting}
              title={deleting ? `Delete ${deleting.name}?` : ""}
              description="Its QR code will stop working. Reports already made there keep their text. Demo only: nothing real changes."
              confirmLabel="Delete location"
              tone="danger"
              onConfirm={() => {
                if (deleting && deleteLocation(deleting.id)) router.replace("/viewer/locations");
                setDeleting(null);
              }}
              onCancel={() => setDeleting(null)}
            />
          </>
        );
      }}
    </ViewerGate>
  );
}

export default function ViewerLocationsPage() {
  return (
    <Suspense fallback={<ViewerLoading />}>
      <LocationsInner />
    </Suspense>
  );
}
