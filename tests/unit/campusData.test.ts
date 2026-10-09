import { describe, expect, it } from "vitest";
import campus from "@/data/campuses/sues-hyderabad/campus.json";
import institutions from "@/data/campuses/sues-hyderabad/institutions.json";
import locations from "@/data/campuses/sues-hyderabad/locations.json";
import sources from "@/data/campuses/sues-hyderabad/research-sources.json";
import geometry from "@/data/campuses/sues-hyderabad/geometry.json";
import {
  BUILDINGS,
  CAMPUS_GRID,
  CAMPUS_LOCATIONS,
  findCanonicalLocation,
  getCanonicalLocation,
  isInCampusView,
  isValidCoordinate,
  project,
  searchCampusLocations,
} from "@/lib/campus";

const STATUSES = ["verified", "corroborated", "approximate", "conflicting", "unverified"];
const sourceIds = new Set(sources.sources.map((s) => s.id));
const institutionIds = new Set(institutions.institutions.map((i) => i.id));
const view = campus.viewport;

type Position = number[];
interface Feature {
  type: string;
  properties: { kind: string; osm?: string; name?: string; label?: string };
  geometry: { type: string; coordinates: unknown };
}
const features = (geometry as unknown as { features: Feature[] }).features;
const positions = (f: Feature): Position[] =>
  f.geometry.type === "Point" ? [f.geometry.coordinates as Position] : f.geometry.type === "LineString" ? (f.geometry.coordinates as Position[]) : (f.geometry.coordinates as Position[][]).flat();

describe("SUES campus identity", () => {
  it("has a stable id, the official address and documented provenance", () => {
    expect(campus.id).toBe("sues-mount-pleasant-hyderabad");
    expect(campus.societyName).toBe("Sultan-ul-Uloom Education Society");
    expect(campus.postalCode).toBe("500034");
    expect(campus.address).toContain("Road No. 3");
    expect(campus.city).toBe("Hyderabad");
    for (const id of campus.addressSourceIds) expect(sourceIds.has(id)).toBe(true);
    expect(campus.centerProvenance.length).toBeGreaterThan(40);
    expect(campus.viewportProvenance.length).toBeGreaterThan(40);
  });

  it("does not claim a boundary that could not be verified", () => {
    expect(campus.boundary).toBeNull();
    expect(campus.boundaryStatus).toBe("unverified");
    expect(campus.disclaimer).toMatch(/not an official product/i);
  });

  it("has a valid centre inside its viewport, in Hyderabad and not swapped", () => {
    const { latitude, longitude } = campus.center;
    expect(isValidCoordinate(latitude, longitude)).toBe(true);
    expect(isInCampusView(latitude, longitude)).toBe(true);
    expect(latitude).toBeGreaterThan(17.3);
    expect(latitude).toBeLessThan(17.6);
    expect(longitude).toBeGreaterThan(78.3);
    expect(longitude).toBeLessThan(78.6);
    expect(view.south).toBeLessThan(view.north);
    expect(view.west).toBeLessThan(view.east);
  });
});

describe("institutions", () => {
  it("lists the on-campus institutions once each, with sources", () => {
    expect(new Set(institutions.institutions.map((i) => i.id)).size).toBe(institutions.institutions.length);
    expect(institutions.institutions.length).toBe(7);
    for (const i of institutions.institutions) {
      expect(i.onMainCampus).toBe(true);
      expect(STATUSES).toContain(i.onMainCampusStatus);
      expect(i.sourceIds.length).toBeGreaterThan(0);
      for (const id of i.sourceIds) expect(sourceIds.has(id), `${i.id} cites ${id}`).toBe(true);
    }
  });

  it("keeps off-campus schools out of the map", () => {
    const oldCity = institutions.elsewhere.find((e) => e.id === "sups-old-city");
    expect(oldCity?.branches).toEqual(["Syed Ali Chabutra", "Golconda", "Khazipura", "Hafiz Baba Nagar"]);
    const text = JSON.stringify([locations.places, locations.locations]).toLowerCase();
    for (const branch of ["chabutra", "golconda", "khazipura", "hafiz baba"]) expect(text).not.toContain(branch);
  });
});

describe("places and locations", () => {
  it("places have unique ids, valid in-campus coordinates, a status and sources", () => {
    expect(new Set(BUILDINGS.map((b) => b.id)).size).toBe(BUILDINGS.length);
    for (const p of locations.places) {
      expect(isValidCoordinate(p.latitude, p.longitude), p.id).toBe(true);
      expect(isInCampusView(p.latitude, p.longitude), `${p.id} lies in the campus view`).toBe(true);
      // Within 400 m of the centre: nothing off-campus is passed off as a campus place.
      const [x, y] = project(p.longitude, p.latitude);
      const [cx, cy] = project(campus.center.longitude, campus.center.latitude);
      expect(Math.hypot(x - cx, y - cy)).toBeLessThan(400);
      expect(STATUSES).toContain(p.verificationStatus);
      expect(p.precisionMeters).toBeGreaterThan(0);
      expect(p.notes.length).toBeGreaterThan(20);
      expect(p.sourceIds.length).toBeGreaterThan(0);
      for (const id of p.sourceIds) expect(sourceIds.has(id), `${p.id} cites ${id}`).toBe(true);
      if (p.institutionId) expect(institutionIds.has(p.institutionId)).toBe(true);
      for (const pattern of p.patterns) expect(() => new RegExp(pattern)).not.toThrow();
      expect(p.patterns.join("")).not.toContain("\b"); // a literal backspace means a broken word boundary
    }
  });

  it("no position is called verified: every one comes from a coarse geotag or a single map source", () => {
    expect(locations.places.filter((p) => p.verificationStatus === "verified")).toEqual([]);
    expect(locations.places.find((p) => p.id === "ghulam-ahmed-hall")?.verificationStatus).toBe("conflicting");
    expect(locations.places.find((p) => p.id === "sbi")?.verificationStatus).toBe("unverified");
  });

  it("distinct places are not stacked on one point", () => {
    for (const a of BUILDINGS) for (const b of BUILDINGS) if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id} / ${b.id}`).toBeGreaterThan(15);
  });

  it("locations have unique ids, valid parents, sources and no invented rooms or floors", () => {
    expect(new Set(CAMPUS_LOCATIONS.map((l) => l.id)).size).toBe(CAMPUS_LOCATIONS.length);
    expect(new Set(CAMPUS_LOCATIONS.map((l) => l.name.toLowerCase())).size).toBe(CAMPUS_LOCATIONS.length);
    for (const l of locations.locations) {
      expect(l.id).toMatch(/^[a-z0-9-]{1,60}$/);
      if (l.placeId) expect(BUILDINGS.some((b) => b.id === l.placeId), `${l.id} → ${l.placeId}`).toBe(true);
      if (l.institutionId) expect(institutionIds.has(l.institutionId)).toBe(true);
      expect(STATUSES).toContain(l.verificationStatus);
      for (const id of l.sourceIds) expect(sourceIds.has(id)).toBe(true);
      expect(l).not.toHaveProperty("floor");
      expect(l).not.toHaveProperty("room");
      expect(l.name).not.toMatch(/room\s*\d/i);
      // A location with no known position must say so rather than borrow a marker.
      if (!l.placeId) expect(l.verificationStatus).toBe("unverified");
    }
  });

  it("the five college blocks and the named halls are present", () => {
    for (const id of ["mjcet-block-1", "mjcet-block-2", "mjcet-block-3", "mjcet-block-4", "mjcet-block-5", "mjcet-seminar-hall", "mjcet-ghulam-ahmed-hall", "mjcet-central-library"]) {
      expect(getCanonicalLocation(id)?.isActive, id).toBe(true);
    }
    expect(getCanonicalLocation("mjcet-central-library")?.placeId).toBeNull();
  });

  it("unknown or malformed location ids resolve to nothing", () => {
    for (const id of ["", "block-a", "labs", "MJCET-BLOCK-1", "../etc", "mjcet-block-9", null, undefined]) expect(getCanonicalLocation(id as string)).toBeUndefined();
  });

  it("search finds locations by name, alias and institution, and nothing for an address", () => {
    expect(searchCampusLocations("block 4").map((l) => l.id)).toEqual(["mjcet-block-4", "mjcet-seminar-hall"]);
    expect(searchCampusLocations("auditorium").map((l) => l.id)).toEqual(["mjcet-ghulam-ahmed-hall"]);
    expect(searchCampusLocations("pharmacy").map((l) => l.id)).toContain("sucp-college");
    expect(searchCampusLocations("12 jubilee hills road")).toEqual([]);
    expect(findCanonicalLocation("the gym lights are off")?.id).toBe("mjcet-gymnasium");
    expect(findCanonicalLocation("nothing to see")).toBeUndefined();
  });
});

describe("map geometry (OpenStreetMap)", () => {
  it("is a GeoJSON FeatureCollection with attribution and licence", () => {
    expect(geometry.type).toBe("FeatureCollection");
    expect(geometry.attribution).toBe("© OpenStreetMap contributors");
    expect(geometry.license).toContain("ODbL");
    expect(geometry.osmBaseTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(features.length).toBeGreaterThan(50);
  });

  it("every feature is valid, cites its OSM element and has [longitude, latitude] order", () => {
    const ids = new Set<string>();
    for (const f of features) {
      expect(f.type).toBe("Feature");
      expect(["Polygon", "LineString", "Point"]).toContain(f.geometry.type);
      expect(f.properties.osm).toMatch(/^(way|node)\/\d+$/);
      expect(ids.has(`${f.properties.kind}:${f.properties.osm}`)).toBe(false);
      ids.add(`${f.properties.kind}:${f.properties.osm}`);
      for (const [lon, lat] of positions(f)) {
        expect(isValidCoordinate(lat, lon)).toBe(true);
        expect(lon).toBeGreaterThan(78); // swapped coordinates would put longitude near 17
        expect(lat).toBeLessThan(18);
      }
      if (f.geometry.type === "Polygon") {
        const ring = (f.geometry.coordinates as Position[][])[0];
        expect(ring.length).toBeGreaterThanOrEqual(4);
        expect(ring[0]).toEqual(ring[ring.length - 1]); // closed ring
      }
      if (f.geometry.type === "LineString") expect((f.geometry.coordinates as Position[]).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("campus footprints are real OSM ways with neutral labels, never a guessed name or use", () => {
    const buildings = features.filter((f) => f.properties.kind === "building");
    expect(buildings.length).toBe(6);
    expect(buildings.map((b) => b.properties.label).sort()).toEqual(["A", "B", "C", "D", "E", "F"].map((l) => `Mapped building ${l}`));
    for (const b of buildings) {
      expect(b.properties.name).toBeUndefined();
      for (const [lon, lat] of positions(b)) expect(isInCampusView(lat, lon)).toBe(true);
    }
    expect(features.filter((f) => f.properties.kind === "campus-outline")).toHaveLength(1);
  });

  it("projects onto a drawing area of plausible size", () => {
    expect(CAMPUS_GRID.width).toBeGreaterThan(400);
    expect(CAMPUS_GRID.width).toBeLessThan(800);
    expect(CAMPUS_GRID.height).toBeGreaterThan(250);
    const [x, y] = project(view.west, view.north);
    expect(Math.abs(x) + Math.abs(y)).toBeLessThan(0.001);
    for (const b of BUILDINGS) {
      expect(b.x).toBeGreaterThan(0);
      expect(b.x).toBeLessThan(CAMPUS_GRID.width);
      expect(b.y).toBeGreaterThan(0);
      expect(b.y).toBeLessThan(CAMPUS_GRID.height);
    }
  });
});

describe("research sources", () => {
  it("every source has a URL and says what it supports; every source is used", () => {
    const used = new Set<string>([
      ...campus.addressSourceIds,
      ...campus.statedArea.map((a) => a.sourceId),
      ...institutions.institutions.flatMap((i) => i.sourceIds),
      ...institutions.elsewhere.flatMap((i) => i.sourceIds),
      ...locations.places.flatMap((p) => p.sourceIds),
      ...locations.locations.flatMap((l) => l.sourceIds),
    ]);
    for (const s of sources.sources) {
      expect(s.url).toMatch(/^https?:\/\//);
      expect(s.supports.length).toBeGreaterThan(20);
      if (!["sues-site", "mjcet-sues-history"].includes(s.id)) expect(used.has(s.id), `${s.id} is cited`).toBe(true);
    }
    expect(sources.accessedAt).toBe(locations.lastVerifiedAt);
  });
});
