"use client";

import React, { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { Copy, Download, Printer, QrCode } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button, { buttonClasses } from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Field";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { ViewerGate, ViewerLoading } from "@/components/viewer/parts";
import { BUILDINGS, getBuilding } from "@/lib/campus";
import { DEMO_LOCATIONS, DemoLocation } from "@/lib/viewer/demoData";
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

function QrDialog({ location, origin, onClose, onCopy }: { location: DemoLocation | null; origin: string; onClose: () => void; onCopy: () => void }) {
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
  const selected = DEMO_LOCATIONS.find((l) => l.id === params.get("location")) ?? null;

  return (
    <ViewerGate>
      {({ demoToast }) => {
        const rows = DEMO_LOCATIONS.filter((l) => (!building || l.buildingId === building) && (!q.trim() || l.name.toLowerCase().includes(q.trim().toLowerCase())));
        const chips: FilterChip[] = building ? [{ key: "b", label: getBuilding(building)?.name ?? building, onRemove: () => setBuilding("") }] : [];
        return (
          <>
            <PageHeader title="Locations and QR codes" description="Every reportable place has a QR code. Scanning it opens the report form with the location filled in." />
            <Card className="mb-4 p-3 sm:p-4">
              <FilterBar search={q} onSearch={setQ} searchLabel="Search locations" placeholder="Search locations" chips={chips} onClear={() => setBuilding("")}>
                <Select size="sm" aria-label="Building" value={building} onChange={(e) => setBuilding(e.target.value)} wrapperClassName="w-auto">
                  <option value="">All buildings</option>
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
                <EmptyState title="No locations match" description="Try a different search or building." />
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
                          {getBuilding(l.buildingId)?.name}
                          {l.floor ? ` · Floor ${l.floor}` : ""}
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
