"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CampusLocation } from "@/types";
import { listCampusLocations } from "@/lib/locations";
import { describeLocation } from "@/lib/campus";
import { logError } from "@/lib/errors";

/** Admin-managed QR locations, plus lookups used by the map and analytics. */
export function useCampusLocations() {
  const [locations, setLocations] = useState<CampusLocation[] | null>(null);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setError(false);
    try {
      setLocations(await listCampusLocations());
    } catch (err) {
      logError("listCampusLocations", err);
      setError(true);
      setLocations((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const buildingMap = useMemo(
    () => new Map((locations ?? []).filter((l) => l.buildingId).map((l) => [l.id, l.buildingId])),
    [locations]
  );
  const nameMap = useMemo(() => new Map((locations ?? []).map((l) => [l.id, describeLocation(l)])), [locations]);

  return { locations, error, reload, buildingMap, nameMap };
}
