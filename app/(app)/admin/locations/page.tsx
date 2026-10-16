"use client";

import React, { useMemo, useRef, useState } from "react";
import { MapPin, Plus, Search as SearchIcon, Trash2 } from "lucide-react";
import { CampusLocation } from "@/types";
import { createCampusLocation, deleteCampusLocation } from "@/lib/locations";
import { BUILDINGS, describeLocation, getBuilding } from "@/lib/campus";
import { getFriendlyErrorMessage, logError } from "@/lib/errors";
import { useCampusLocations } from "@/hooks/useCampusLocations";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Dialog, { ConfirmDialog } from "@/components/ui/Dialog";
import { Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice, SkeletonRows } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";

export default function AdminLocationsPage() {
  const { locations, error, reload } = useCampusLocations();
  const toast = useToast();
  const [query, setQuery] = useState("");
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
        title="Locations"
        description="Places on campus that people can choose when they report an issue."
        actions={
          <Button icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={() => setAddOpen(true)}>
            Add location
          </Button>
        }
      />

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
            icon={<MapPin />}
            title="No locations yet"
            description="Add a lab, washroom or classroom so it can be chosen when reporting."
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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">{loc.name}</p>
                  <p className="flex items-center gap-1 truncate text-[13px] text-fg-subtle">
                    <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {[getBuilding(loc.buildingId)?.name ?? "Not placed on the map", loc.floor && `Floor ${loc.floor}`, loc.room && `Room ${loc.room}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
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
        description="It will be available to choose when reporting an issue."
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

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting ? describeLocation(deleting) : ""}”?`}
        description="It will no longer be offered when reporting. Existing reports are not affected."
        confirmLabel="Delete location"
        tone="danger"
        busy={busyDelete}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
