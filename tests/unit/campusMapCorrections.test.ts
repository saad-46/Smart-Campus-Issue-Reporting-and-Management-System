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
import { REMOVED_GATES } from "@/lib/campus";

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
    expect([b.latitude, b.longitude, b.precisionMeters]).toEqual([17.4281, 78.4419, 35]);
    expect(location("mjcet-block-3").placeId).toBe("blocks-3-4");
  });

  it("Blocks 1 and 4 are one building with one marker, on the footprint the owner marked", () => {
    const b = place("blocks-1-4");
    expect(b.short).toBe("Blocks 1 & 4");
    expect(b.footprint).toBe("way/897374294");
    expect(b.sourceIds).toContain("owner-annotation");
    for (const id of ["mjcet-block-1", "mjcet-block-4", "mjcet-seminar-hall"]) expect(location(id).placeId, id).toBe("blocks-1-4");
    expect(matchBuilding("Block 1, Room 12")?.id).toBe("blocks-1-4");
    expect(matchBuilding("Block IV near the lift")?.id).toBe("blocks-1-4");
    expect(matchBuilding("Seminar Hall")?.id).toBe("blocks-1-4");
    // No separate active marker names Block 1 or Block 4 on its own, and no other place matches their text.
    const standalone = BUILDINGS.filter((p) => /\bblocks?\b.*\b(1|4)\b/i.test(`${p.name} ${p.short}`));
    expect(standalone.map((p) => p.id)).toEqual(["blocks-1-4"]);
    for (const p of BUILDINGS.filter((x) => x.id !== "blocks-1-4")) {
      for (const text of ["Block 1", "Block 4", "Block-4 stairs", "Block I", "Block IV"]) expect(p.patterns.some((re) => re.test(text.toLowerCase())), `${p.id} matches "${text}"`).toBe(false);
    }
    // The stable ids Block 3 and Block 5 stand on are kept, and each is now named for what it holds.
    expect([place("blocks-3-4").short, place("blocks-1-2-5").short]).toEqual(["Block 3", "Block 5"]);
    expect(location("mjcet-block-3").placeId).toBe("blocks-3-4");
    expect(location("mjcet-block-5").placeId).toBe("blocks-1-2-5");
    expect(matchBuilding("Block 5 entrance")?.id).toBe("blocks-1-2-5");
    // The reportable location ids that existing reports hold are all still there.
    for (const id of ["mjcet-block-1", "mjcet-block-2", "mjcet-block-3", "mjcet-block-4", "mjcet-block-5", "mjcet-seminar-hall"]) expect(getCanonicalLocation(id)?.isActive, id).toBe(true);
    expect(buildingForIssue({ location: "Block 4, second floor", locationId: "mjcet-block-4" })?.id).toBe("blocks-1-4");
  });

  it("SUCL and MBA are the map labels; the full names stay in the records and searches", () => {
    expect(place("college-of-law").short).toBe("SUCL");
    expect(place("business-administration").short).toBe("MBA");
    expect(place("college-of-law").name).toBe("Sultan-Ul-Uloom College of Law");
    expect(place("business-administration").name).toBe("Amjad Ali Khan College of Business Administration");
    expect(searchCampusLocations("sucl").map((l) => l.id)).toEqual([]); // not a name: only the map label
    expect(matchBuilding("SUCL library")?.id).toBe("college-of-law");
    expect(matchBuilding("MBA seminar room")?.id).toBe("business-administration");
    expect(searchCampusLocations("college of law").map((l) => l.id)).toContain("law-college");
    expect(searchCampusLocations("business administration").map((l) => l.id)).toContain("aakcba-college");
    expect(BUILDINGS.some((b) => b.short === "College of Law" || b.short === "Business Administration")).toBe(false);
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

describe("the two roadside gates are not drawn", () => {
  const gates = geometry.features.filter((f) => f.properties.kind === "gate");

  it("names the two Garden-side gates and the additional owner-crossed gate by OSM id, and all exist in the geometry", () => {
    expect([...REMOVED_GATES].sort()).toEqual(["node/10803590216", "node/11038449765", "node/11039495994"]);
    for (const id of REMOVED_GATES) expect(gates.some((g) => g.properties.osm === id), id).toBe(true);
  });

  it("leaves the other three gates, and the imported geometry, untouched", () => {
    expect(gates).toHaveLength(6);
    const kept = gates.filter((g) => !REMOVED_GATES.includes(g.properties.osm as string));
    expect(kept.map((g) => g.properties.osm).sort()).toEqual(["node/11039323503", "node/11039323504", "node/7682407084"]);
  });

  it("the map filters by id only, never by drawing style", () => {
    const src = readFileSync(join(__dirname, "..", "..", "components", "admin", "CampusMap.tsx"), "utf8");
    expect(src).toContain("REMOVED_GATES.includes(s.osm)");
    expect(src).toContain('of("gate")');
  });
});

describe("map marker interaction", () => {
  const src = readFileSync(join(__dirname, "..", "..", "components", "admin", "CampusMap.tsx"), "utf8");
  const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

  it("a selected marker is a pressed button with a one-shot halo, and keyboard focus has its own ring", () => {
    expect(src).toContain("aria-pressed={interactive ? selected : undefined}");
    expect(src).toContain('data-selected={selected ? "true" : undefined}');
    expect(src).toContain("{selected && (");
    expect(src).toContain("focus-ring");
    expect(src).toContain('e.key === "Enter" || e.key === " "');
  });

  it("repeated selection toggles, and a drag never selects", () => {
    expect(src).toContain("onSelect?.(selected ? null : id)");
    expect(src).toContain("justDragged");
  });

  it("the animation is short and is removed under reduced motion, leaving a static selected state", () => {
    expect(css).toContain(".map-pulse { transform-box: fill-box; transform-origin: center; animation: map-halo 520ms");
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain(".map-pulse { display: none; }");
    expect(reduced).toContain('[data-selected="true"] > .map-marker { animation: none; }');
    expect(css).toContain("transform: scale(1.12)"); // the static selected size stays
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
