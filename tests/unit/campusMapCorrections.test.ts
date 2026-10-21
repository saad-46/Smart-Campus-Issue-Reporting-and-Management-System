import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import geometry from "@/data/campuses/sues-hyderabad/geometry.json";
import locationsJson from "@/data/campuses/sues-hyderabad/locations.json";
import {
  BUILDINGS,
  CAMPUS_LOCATIONS,
  RETIRED_LOCATIONS,
  buildingForIssue,
  getBuilding,
  getCanonicalLocation,
  getRetiredLocation,
  matchBuilding,
  searchCampusLocations,
} from "@/lib/campus";
import { DEMO_LOCATIONS } from "@/lib/viewer/demoData";

// The owner's annotated campus map (2026-10-19): which footprint is which place.

const place = (id: string) => BUILDINGS.find((b) => b.id === id)!;
const location = (id: string) => CAMPUS_LOCATIONS.find((l) => l.id === id)!;
const ways = new Set(geometry.features.map((f) => f.properties.osm));

describe("campus map corrections", () => {
  it("Ghulam Ahmed Hall and Block 2 are one physical place", () => {
    const hall = location("mjcet-ghulam-ahmed-hall");
    const block2 = location("mjcet-block-2");
    expect(hall.placeId).toBe("ghulam-ahmed-hall");
    expect(block2.placeId).toBe(hall.placeId);
    expect(place("ghulam-ahmed-hall").footprint).toBe("way/340053345");
    expect(BUILDINGS.filter((b) => b.footprint === "way/340053345")).toHaveLength(1);
    expect(matchBuilding("Block 2, Room 204")?.id).toBe("ghulam-ahmed-hall");
    expect(matchBuilding("Ghulam Ahmed Hall, stage")?.id).toBe("ghulam-ahmed-hall");
    expect(searchCampusLocations("block 2").map((l) => l.id)).toContain("mjcet-block-2");
    expect(searchCampusLocations("auditorium").map((l) => l.id)).toContain("mjcet-ghulam-ahmed-hall");
  });

  it("Block 3 keeps the position it had before the corrections", () => {
    const b = place("blocks-3-4");
    expect([b.latitude, b.longitude, b.precisionMeters]).toEqual([17.4277, 78.442, 60]);
    expect(location("mjcet-block-3").placeId).toBe("blocks-3-4");
  });

  it("Blocks 1 and 5 no longer share an anchor with Block 2", () => {
    expect(location("mjcet-block-1").placeId).toBe("blocks-1-2-5");
    expect(location("mjcet-block-5").placeId).toBe("blocks-1-2-5");
    expect(matchBuilding("Block 5 entrance")?.id).toBe("blocks-1-2-5");
    expect(place("blocks-1-2-5").short).toBe("Blocks 1 · 5");
  });

  it.each([
    ["mjcet-masjid", "masjid", "way/340051389"],
    ["mjcet-sports-center", "sports-center", "way/775585790"],
    ["aakcba-college", "business-administration", "way/340052921"],
    ["law-college", "college-of-law", "way/340053223"],
    ["sujc-college", "sups-sujc", "way/340053098"],
    ["sups-bh-school", "sups-sujc", "way/340053098"],
  ])("%s is reportable and stands on %s (%s)", (locationId, placeId, way) => {
    const l = getCanonicalLocation(locationId)!;
    expect(l.isActive).toBe(true);
    expect(l.placeId).toBe(placeId);
    expect(place(placeId).footprint).toBe(way);
    expect(ways.has(way)).toBe(true);
    expect(buildingForIssue({ location: l.name, locationId })?.id).toBe(placeId);
    expect(searchCampusLocations(l.name).map((x) => x.id)).toContain(locationId);
  });

  it("each place sits inside the footprint it names", () => {
    for (const b of BUILDINGS.filter((p) => p.footprint)) {
      const f = geometry.features.find((x) => x.properties.osm === b.footprint)!;
      const ring = (f.geometry as { coordinates: number[][][] }).coordinates[0];
      const lons = ring.map((p) => p[0]);
      const lats = ring.map((p) => p[1]);
      expect(b.longitude, b.id).toBeGreaterThan(Math.min(...lons));
      expect(b.longitude, b.id).toBeLessThan(Math.max(...lons));
      expect(b.latitude, b.id).toBeGreaterThan(Math.min(...lats));
      expect(b.latitude, b.id).toBeLessThan(Math.max(...lats));
    }
  });

  it("SUPS and SUJC share one marker and have separate, unambiguous records", () => {
    const sups = location("sups-bh-school");
    const sujc = location("sujc-college");
    expect(sups.placeId).toBe(sujc.placeId);
    expect(sups.name).not.toBe(sujc.name);
    expect(BUILDINGS.filter((b) => b.id === "sups-sujc")).toHaveLength(1);
  });

  it("no two places are drawn on one footprint, and ids are unique", () => {
    const fps = BUILDINGS.map((b) => b.footprint).filter(Boolean);
    expect(new Set(fps).size).toBe(fps.length);
    expect(new Set(BUILDINGS.map((b) => b.id)).size).toBe(BUILDINGS.length);
    expect(new Set(CAMPUS_LOCATIONS.map((l) => l.id)).size).toBe(CAMPUS_LOCATIONS.length);
    for (const l of CAMPUS_LOCATIONS) if (l.placeId) expect(getBuilding(l.placeId), `${l.id} -> ${l.placeId}`).toBeDefined();
    for (const b of BUILDINGS) expect(CAMPUS_LOCATIONS.some((l) => l.placeId === b.id), `place ${b.id} has a reportable location`).toBe(true);
  });

  it("the owner's identification is recorded as user-supplied, not as map metadata", () => {
    for (const id of ["masjid", "sports-center", "ghulam-ahmed-hall", "business-administration", "college-of-law", "sups-sujc"]) {
      expect(place(id).sourceIds).toContain("owner-annotation");
      expect(place(id).verificationStatus).toBe("approximate");
    }
  });
});

describe("Shuttle court is retired", () => {
  const SHUTTLE = /shuttle|physical education|badminton/i;

  it("is in no active place, location, alias, search or demo location", () => {
    expect(BUILDINGS.filter((b) => SHUTTLE.test(`${b.id} ${b.name} ${b.short} ${b.notes}`))).toEqual([]);
    expect(CAMPUS_LOCATIONS.filter((l) => SHUTTLE.test(`${l.id} ${l.name} ${l.aliases.join(" ")}`))).toEqual([]);
    expect(DEMO_LOCATIONS.filter((l) => SHUTTLE.test(`${l.id} ${l.name} ${l.spot}`))).toEqual([]);
    expect(searchCampusLocations("shuttle")).toEqual([]);
    expect(searchCampusLocations("badminton")).toEqual([]);
    expect(BUILDINGS.some((b) => b.patterns.some((p) => p.test("shuttle court")))).toBe(false);
  });

  it("is listed as retired, never reused, and never matched to another building", () => {
    expect(RETIRED_LOCATIONS.map((r) => r.id)).toEqual(["mjcet-shuttle-court"]);
    expect(getRetiredLocation("mjcet-shuttle-court")?.name).toMatch(/shuttle court/i);
    expect(getCanonicalLocation("mjcet-shuttle-court")).toBeUndefined();
    expect(CAMPUS_LOCATIONS.some((l) => l.id === "mjcet-shuttle-court")).toBe(false);
    // A historical report keeps its text; the map shows it as not placed.
    expect(matchBuilding("Shuttle court (Physical Education)")).toBeUndefined();
    expect(buildingForIssue({ location: "Shuttle court (Physical Education)", locationId: "mjcet-shuttle-court" })).toBeUndefined();
    expect(buildingForIssue({ location: "Shuttle court, next to Block 1", locationId: "mjcet-shuttle-court" })).toBeUndefined();
  });

  it("is not in the seed script's reporting places", () => {
    const seed = readFileSync(join(__dirname, "..", "..", "scripts", "seed-emulator.mjs"), "utf8");
    expect(seed).not.toMatch(SHUTTLE);
  });
});

describe("building letters are not place names", () => {
  it("no place, location or alias is called A, B, C, D, E or F, or 'Mapped building'", () => {
    const names = [...BUILDINGS.flatMap((b) => [b.name, b.short]), ...CAMPUS_LOCATIONS.flatMap((l) => [l.name, ...l.aliases])];
    for (const n of names) {
      expect(n).not.toMatch(/^[A-F]$/);
      expect(n).not.toMatch(/mapped building/i);
    }
  });

  it("the map no longer draws a letter on a footprint", () => {
    const src = readFileSync(join(__dirname, "..", "..", "components", "admin", "CampusMap.tsx"), "utf8");
    expect(src).not.toContain("Mapped building");
    expect(src).not.toMatch(/A[–-]F/); // the legend no longer presents letters as building names
  });
});

describe("the retired and removed places stay out of the data", () => {
  it("locations.json has no Gymnasium or SBI, and keeps the retirement record", () => {
    const text = JSON.stringify({ ...locationsJson, retiredLocations: undefined });
    expect(text).not.toMatch(/gymnasium|\bgym\b|\bsbi\b|state bank/i);
    expect(locationsJson.retiredLocations).toHaveLength(1);
  });
});
