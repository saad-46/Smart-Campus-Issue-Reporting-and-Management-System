"use client";

import React, { useState } from "react";
import { MapPin, Plus } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Dialog, { ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Field";
import { FilterBar, FilterChip } from "@/components/ui/Filters";
import { EmptyState } from "@/components/ui/States";
import { ViewerGate } from "@/components/viewer/parts";
import { BUILDINGS, VERIFICATION_LABELS, getBuilding, institutionName } from "@/lib/campus";
import Badge from "@/components/ui/Badge";
import { VERIFICATION_TONE } from "@/components/viewer/verification";
import { DemoLocation } from "@/lib/viewer/demoData";

function LocationDetails({ location, onClose, onDelete }: { location: DemoLocation | null; onClose: () => void; onDelete: () => void }) {
  return (
    <Dialog open={!!location} onClose={onClose} title={location?.name ?? "Location"} description="A place people can choose when they report an issue." size="sm">
      {location && (
        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-1.5 text-fg-muted">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            {institutionName(location.institutionId, true) ?? "Campus"} · {getBuilding(location.buildingId)?.name ?? "not on the map"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={VERIFICATION_TONE[location.verificationStatus]}>{VERIFICATION_LABELS[location.verificationStatus]}</Badge>
            {location.custom && <Badge tone="info">Added in this demo</Badge>}
          </div>
          {location.custom ? (
            <>
              <p className="text-xs text-fg-subtle">Added in this demo, so it lasts until you leave or reset.</p>
              <Button variant="ghost" size="sm" className="text-danger hover:text-danger" onClick={onDelete}>
                Delete this location
              </Button>
            </>
          ) : (
            <p className="text-xs text-fg-subtle">Part of the researched campus dataset, so it can&apos;t be deleted here.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

export default function ViewerLocationsPage() {
  const [q, setQ] = useState("");
  const [building, setBuilding] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", buildingId: "", floor: "", room: "" });
  const [formError, setFormError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DemoLocation | null>(null);

  return (
    <ViewerGate>
      {({ locations, addLocation, deleteLocation }) => {
        const selected = locations.find((l) => l.id === selectedId) ?? null;
        const rows = locations.filter((l) => (!building || l.buildingId === building) && (!q.trim() || l.name.toLowerCase().includes(q.trim().toLowerCase())));
        const chips: FilterChip[] = building ? [{ key: "b", label: getBuilding(building)?.name ?? building, onRemove: () => setBuilding("") }] : [];
        return (
          <>
            <PageHeader
              title="Locations"
              description="Researched SUES campus locations, plus any you add. People choose from these when they report an issue."
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
                    <button type="button" onClick={() => setSelectedId(l.id)} className="glass lift flex w-full items-center gap-3 rounded-xl p-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle text-brand-fg">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-fg">{l.name}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-fg-subtle">
                          {institutionName(l.institutionId, true) ?? "Campus"} · {getBuilding(l.buildingId)?.name ?? "not on the map"}
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

            <LocationDetails location={selected} onClose={() => setSelectedId(null)} onDelete={() => setDeleting(selected)} />

            <Dialog
              open={addOpen}
              onClose={() => setAddOpen(false)}
              title="Add location"
              description="A place people can report against. Demo only: it lasts until you leave or reset the demo."
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
                    setSelectedId(result.id);
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
              description="It will no longer be offered when reporting. Reports already made there keep their text. Demo only: nothing real changes."
              confirmLabel="Delete location"
              tone="danger"
              onConfirm={() => {
                if (deleting && deleteLocation(deleting.id)) setSelectedId(null);
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
