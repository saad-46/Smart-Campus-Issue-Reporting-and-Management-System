// ============================================
// SUES campus model (Mount Pleasant, Banjara Hills, Hyderabad)
// ============================================
// Everything here comes from data/campuses/sues-hyderabad/*.json, a researched
// dataset with a source and a confidence level on every record (see
// docs/SUES_CAMPUS_RESEARCH.md). Nothing is geocoded or fetched at run time.
//
// Two levels:
//   places     map anchors with coordinates (e.g. "Blocks 3 and 4"). Issues are
//              counted per place for the map, hotspots and risk indicators.
//   locations  things a person can pick when reporting (e.g. "Block 4",
//              "Seminar Hall, Block 4"). A location may have no place when its
//              position inside the campus is not publicly known; such issues
//              are reported as "not placed on the map" instead of being guessed.
//
// `Building` keeps its name for the many callers written before the campus
// was real: a Building is a place.

import campusJson from "@/data/campuses/sues-hyderabad/campus.json";
import institutionsJson from "@/data/campuses/sues-hyderabad/institutions.json";
import locationsJson from "@/data/campuses/sues-hyderabad/locations.json";

export type VerificationStatus = "verified" | "corroborated" | "approximate" | "conflicting" | "unverified";

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  verified: "Verified",
  corroborated: "Corroborated",
  approximate: "Approximate position",
  conflicting: "Sources disagree",
  unverified: "Unverified",
};

export const VERIFICATION_MEANINGS = locationsJson.statusMeanings as Record<VerificationStatus, string>;

export type PlaceType = "academic" | "hall" | "institution" | "sports" | "grounds" | "bank" | "library";

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  academic: "Academic block",
  hall: "Hall",
  institution: "Institution",
  sports: "Sports",
  grounds: "Grounds",
  bank: "Bank",
  library: "Library",
};

export const CAMPUS = campusJson;
export const INSTITUTIONS = institutionsJson.institutions;
export const INSTITUTIONS_ELSEWHERE = institutionsJson.elsewhere;

export function institutionName(id: string | null | undefined, short = false): string | undefined {
  const i = INSTITUTIONS.find((x) => x.id === id);
  return i ? (short ? i.shortName : i.name) : undefined;
}

// ---------- Projection ----------
// A flat local projection of the documented viewport, in metres from its
// north-west corner. Accurate to well under a metre over a 600 m wide area.

const VIEW = campusJson.viewport;
const METRES_PER_DEG_LAT = 110_700;
const METRES_PER_DEG_LON = 111_320 * Math.cos((((VIEW.south + VIEW.north) / 2) * Math.PI) / 180);

/** Size of the drawn area in metres (the SVG viewBox of the map). */
export const CAMPUS_GRID = {
  width: Math.round((VIEW.east - VIEW.west) * METRES_PER_DEG_LON),
  height: Math.round((VIEW.north - VIEW.south) * METRES_PER_DEG_LAT),
} as const;

/** WGS84 longitude/latitude → map metres [x, y] (y grows southwards). */
export function project(longitude: number, latitude: number): [number, number] {
  return [(longitude - VIEW.west) * METRES_PER_DEG_LON, (VIEW.north - latitude) * METRES_PER_DEG_LAT];
}

export function isValidCoordinate(latitude: unknown, longitude: unknown): boolean {
  return (
    typeof latitude === "number" && typeof longitude === "number" && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
  );
}

/** Whether a point lies in the drawn campus area (a drawing extent, not a geofence). */
export function isInCampusView(latitude: number, longitude: number): boolean {
  return latitude >= VIEW.south && latitude <= VIEW.north && longitude >= VIEW.west && longitude <= VIEW.east;
}

// ---------- Places ----------

export interface Building {
  id: string;
  name: string;
  /** Short label drawn on the map. */
  short: string;
  type: PlaceType;
  institutionId: string | null;
  latitude: number;
  longitude: number;
  /** Position on the map, in metres from the north-west corner of the view. */
  x: number;
  y: number;
  /** How far the true position may be from the marker. */
  precisionMeters: number;
  verificationStatus: VerificationStatus;
  sourceIds: string[];
  notes: string;
  /** Lower-case patterns that identify this place in free-text locations. */
  patterns: RegExp[];
}

export const BUILDINGS: Building[] = locationsJson.places.map((p) => {
  const [x, y] = project(p.longitude, p.latitude);
  return {
    id: p.id,
    name: p.name,
    short: p.short,
    type: p.type as PlaceType,
    institutionId: p.institutionId,
    latitude: p.latitude,
    longitude: p.longitude,
    x,
    y,
    precisionMeters: p.precisionMeters,
    verificationStatus: p.verificationStatus as VerificationStatus,
    sourceIds: p.sourceIds,
    notes: p.notes,
    patterns: p.patterns.map((source) => new RegExp(source)),
  };
});

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

export function getBuilding(id: string | undefined | null): Building | undefined {
  return id ? BY_ID.get(id) : undefined;
}

// ---------- Reportable locations ----------

export interface CampusPlace {
  id: string;
  name: string;
  aliases: string[];
  type: PlaceType;
  institutionId: string | null;
  /** Map anchor, or null when the position inside the campus is not known. */
  placeId: string | null;
  description?: string;
  verificationStatus: VerificationStatus;
  sourceIds: string[];
  isActive: boolean;
}

export const CAMPUS_LOCATIONS: CampusPlace[] = locationsJson.locations.map((l) => ({
  id: l.id,
  name: l.name,
  aliases: l.aliases,
  type: l.type as PlaceType,
  institutionId: l.institutionId,
  placeId: l.placeId,
  description: "description" in l ? (l.description as string) : undefined,
  verificationStatus: l.verificationStatus as VerificationStatus,
  sourceIds: l.sourceIds,
  isActive: l.isActive,
}));

const LOCATION_BY_ID = new Map(CAMPUS_LOCATIONS.map((l) => [l.id, l]));

/** A canonical campus location by its stable id (used by QR codes and forms). */
export function getCanonicalLocation(id: string | undefined | null): CampusPlace | undefined {
  return id ? LOCATION_BY_ID.get(id) : undefined;
}

/** Canonical locations whose name or an alias contains the query (case-insensitive). */
export function searchCampusLocations(query: string, includeInactive = false): CampusPlace[] {
  const q = query.trim().toLowerCase();
  const pool = CAMPUS_LOCATIONS.filter((l) => includeInactive || l.isActive);
  if (!q) return pool;
  return pool.filter((l) => [l.name, ...l.aliases, institutionName(l.institutionId) ?? ""].some((text) => text.toLowerCase().includes(q)));
}

/**
 * A canonical location mentioned in free text, by name or alias (whole words).
 * Used to suggest a location in the chat reporter; the person can change it.
 */
export function findCanonicalLocation(text: string): CampusPlace | undefined {
  const haystack = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const has = (phrase: string) => haystack.includes(` ${phrase.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `);
  return CAMPUS_LOCATIONS.find((l) => l.isActive && has(l.name)) ?? CAMPUS_LOCATIONS.find((l) => l.isActive && l.aliases.some((a) => a.length >= 3 && has(a)));
}

/**
 * Best-effort place for a free-text location ("Block 4, room near the stairs").
 * Canonical names win, then the place patterns. Returns undefined when nothing
 * matches: callers show such issues as "not placed" rather than guessing, which
 * is also how reports written before this dataset existed are handled.
 */
export function matchBuilding(location: string | undefined | null): Building | undefined {
  const text = (location ?? "").toLowerCase();
  if (!text.trim()) return undefined;
  const named = CAMPUS_LOCATIONS.find((l) => text.includes(l.name.toLowerCase()));
  if (named) return getBuilding(named.placeId);
  return BUILDINGS.find((b) => b.patterns.some((p) => p.test(text)));
}

/**
 * Place for an issue: an exact QR / canonical location wins, otherwise the text.
 * `locationBuildings` maps campusLocations ids to place ids.
 */
export function buildingForIssue(
  issue: { location: string; locationId?: string },
  locationBuildings: Map<string, string> = new Map()
): Building | undefined {
  if (issue.locationId) {
    const fromQr = getBuilding(locationBuildings.get(issue.locationId));
    if (fromQr) return fromQr;
    const canonical = getCanonicalLocation(issue.locationId);
    // A known location with no known position stays unplaced; don't fall back to guessing from its name.
    if (canonical) return getBuilding(canonical.placeId);
  }
  return matchBuilding(issue.location);
}

/** URL-safe id for a new campus location ("Block 2 Room 204" → "block-2-room-204"). */
export function slugifyLocation(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Human-readable label for a QR location. */
export function describeLocation(loc: { name: string; buildingId: string; floor: string; room: string }): string {
  const building = getBuilding(loc.buildingId)?.name;
  const parts = [loc.name];
  if (building && !loc.name.toLowerCase().includes(building.toLowerCase())) parts.push(building);
  if (loc.floor) parts.push(`Floor ${loc.floor}`);
  if (loc.room && !loc.name.toLowerCase().includes(loc.room.toLowerCase())) parts.push(`Room ${loc.room}`);
  return parts.join(", ");
}
