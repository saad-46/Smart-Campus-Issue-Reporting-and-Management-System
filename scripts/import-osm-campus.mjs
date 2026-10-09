#!/usr/bin/env node
// ============================================
// Import OpenStreetMap geometry for the SUES campus map
// ============================================
// Turns an Overpass API JSON extract into the small GeoJSON file the app
// draws (data/campuses/sues-hyderabad/geometry.json). Run it by hand when the
// map data should be refreshed; the app never calls Overpass itself.
//
//   1. Download the extract (one request; see data/campuses/sues-hyderabad/README.md):
//        [out:json][timeout:60];(nwr(17.4235,78.4385,17.4325,78.4500););(._;>;);out body qt;
//   2. node scripts/import-osm-campus.mjs path/to/extract.json
//   3. npm test   (tests/unit/campusData.test.ts validates the result)
//
// Data © OpenStreetMap contributors, Open Database License (ODbL) 1.0.
// Nothing here assigns a name or a use to a building: OSM has none for this
// campus, so footprints stay anonymous (see locations.json for what is known).

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: node scripts/import-osm-campus.mjs <overpass-extract.json>");
  process.exit(1);
}

/** The area drawn by the map: [south, west, north, east]. Documented in campus.json. */
const VIEW = [17.4265, 78.4405, 17.4296, 78.4458];
const CAMPUS_WAY = 737548446; // amenity=college "Muffakham Jah College Of Engineering And Technology"
const PHARMACY_WAY = 737603230; // amenity=college "Sultan Ul Uloom College of Pharmacy"

const raw = JSON.parse(readFileSync(input, "utf8"));
const nodes = new Map(raw.elements.filter((e) => e.type === "node").map((n) => [n.id, n]));
const ways = raw.elements.filter((e) => e.type === "way");
const round = (n) => Math.round(n * 1e7) / 1e7;
const coords = (w) => w.nodes.map((id) => nodes.get(id)).filter(Boolean).map((n) => [round(n.lon), round(n.lat)]);
const closed = (w) => w.nodes.length > 3 && w.nodes[0] === w.nodes[w.nodes.length - 1];
const centre = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const inView = ([lon, lat]) => lat >= VIEW[0] && lat <= VIEW[2] && lon >= VIEW[1] && lon <= VIEW[3];

function inside([x, y], poly) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[j];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) hit = !hit;
  }
  return hit;
}

const campusWay = ways.find((w) => w.id === CAMPUS_WAY);
if (!campusWay) throw new Error(`Campus way ${CAMPUS_WAY} is not in the extract.`);
const campusRing = coords(campusWay);

const features = [];
const add = (kind, geometry, properties) => features.push({ type: "Feature", properties: { kind, ...properties }, geometry });
const polygon = (pts) => ({ type: "Polygon", coordinates: [pts] });
const line = (pts) => ({ type: "LineString", coordinates: pts });

add("campus-outline", polygon(campusRing), { osm: `way/${CAMPUS_WAY}`, name: campusWay.tags.name });
const pharmacy = ways.find((w) => w.id === PHARMACY_WAY);
if (pharmacy) add("institution-outline", polygon(coords(pharmacy)), { osm: `way/${PHARMACY_WAY}`, name: pharmacy.tags.name });

let letter = 0;
const onCampus = [];
for (const w of ways) {
  if (w.id === CAMPUS_WAY || w.id === PHARMACY_WAY) continue;
  const t = w.tags ?? {};
  const pts = coords(w);
  if (pts.length < 2) continue;
  const c = centre(pts);
  if (!pts.some(inView)) continue;

  if (t.building && closed(w)) {
    const within = inside(c, campusRing);
    if (within) onCampus.push({ w, pts, c });
    else add("building-context", polygon(pts), { osm: `way/${w.id}` });
  } else if (t.highway) {
    const kind = t.highway === "path" || t.highway === "footway" ? "path" : ["service"].includes(t.highway) ? "service-road" : "road";
    add(kind, line(pts), { osm: `way/${w.id}`, ...(t.name ? { name: t.name } : {}), ...(t.access ? { access: t.access } : {}), highway: t.highway });
  } else if (t.leisure === "park" && closed(w)) {
    add("garden", polygon(pts), { osm: `way/${w.id}`, ...(t.name ? { name: t.name } : {}), ...(t.operator ? { operator: t.operator } : {}) });
  } else if (t.landuse === "grass" && closed(w)) {
    add("grass", polygon(pts), { osm: `way/${w.id}` });
  } else if (t.natural === "water" && closed(w)) {
    add("water", polygon(pts), { osm: `way/${w.id}` });
  }
}

// Stable, neutral labels for the footprints inside the mapped campus outline: west to east.
onCampus.sort((a, b) => a.c[0] - b.c[0]);
for (const { w, pts } of onCampus) {
  add("building", polygon(pts), { osm: `way/${w.id}`, label: `Mapped building ${String.fromCharCode(65 + letter++)}`, functionVerified: false });
}

for (const n of nodes.values()) {
  // Gates far from the mapped college outline belong to neighbouring plots.
  const near = campusRing.some(([lon, lat]) => Math.hypot((lon - n.lon) * 106200, (lat - n.lat) * 111320) < 130);
  if (n.tags?.barrier === "gate" && inView([n.lon, n.lat]) && near) {
    add("gate", { type: "Point", coordinates: [round(n.lon), round(n.lat)] }, { osm: `node/${n.id}`, ...(n.tags.access ? { access: n.tags.access } : {}) });
  }
}

const out = {
  type: "FeatureCollection",
  name: "sues-mount-pleasant-hyderabad",
  attribution: "© OpenStreetMap contributors",
  license: "Open Database License (ODbL) 1.0, https://opendatacommons.org/licenses/odbl/1-0/",
  source: "OpenStreetMap via the Overpass API",
  osmBaseTimestamp: raw.osm3s?.timestamp_osm_base ?? null,
  bbox: [VIEW[1], VIEW[0], VIEW[3], VIEW[2]],
  features,
};

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "campuses", "sues-hyderabad", "geometry.json");
writeFileSync(target, JSON.stringify(out) + "\n");
const count = (k) => features.filter((f) => f.properties.kind === k).length;
console.log(
  `Wrote ${features.length} features: ${count("building")} campus buildings, ${count("building-context")} surrounding buildings, ` +
    `${count("road") + count("service-road")} roads, ${count("path")} paths, ${count("gate")} gates.`
);
