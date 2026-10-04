// ============================================
// Campus layout
// ============================================
// A schematic of the campus used by the map, the maintenance risk
// indicators and QR locations. Positions are layout coordinates on a
// 100 × 64 grid — NOT GPS. Edit this list to match your campus; nothing
// else in the app needs to change.

export interface Building {
  id: string;
  name: string;
  /** Short label drawn on the map. */
  short: string;
  /** Layout rectangle on the 100 × 64 grid. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Lower-case patterns that identify this building in free-text locations. */
  patterns: RegExp[];
}

export const CAMPUS_GRID = { width: 100, height: 64 } as const;

export const BUILDINGS: Building[] = [
  { id: "block-a", name: "Block A", short: "A", x: 4, y: 4, w: 16, h: 12, patterns: [/\bblock[\s-]*a\b/, /\ba[\s-]*block\b/] },
  { id: "block-b", name: "Block B", short: "B", x: 24, y: 4, w: 16, h: 12, patterns: [/\bblock[\s-]*b\b/, /\bb[\s-]*block\b/] },
  { id: "block-c", name: "Block C", short: "C", x: 44, y: 4, w: 16, h: 12, patterns: [/\bblock[\s-]*c\b/, /\bc[\s-]*block\b/] },
  { id: "block-d", name: "Block D", short: "D", x: 64, y: 4, w: 16, h: 12, patterns: [/\bblock[\s-]*d\b/, /\bd[\s-]*block\b/] },
  { id: "block-e", name: "Block E", short: "E", x: 84, y: 4, w: 12, h: 12, patterns: [/\bblock[\s-]*e\b/, /\be[\s-]*block\b/] },
  { id: "library", name: "Central Library", short: "Library", x: 4, y: 22, w: 20, h: 14, patterns: [/\blibrar/, /\breading room\b/] },
  { id: "labs", name: "Laboratory Complex", short: "Labs", x: 28, y: 22, w: 22, h: 14, patterns: [/\blabs?\b/, /\blaborator/, /\bworkshop\b/] },
  { id: "admin", name: "Administration", short: "Admin", x: 54, y: 22, w: 18, h: 14, patterns: [/\badmin(istration)?\s*(block|building|office)\b/, /\bprincipal\b/, /\baccounts? office\b/] },
  { id: "auditorium", name: "Auditorium", short: "Auditorium", x: 76, y: 22, w: 20, h: 14, patterns: [/\bauditorium\b/, /\bseminar hall\b/] },
  { id: "canteen", name: "Canteen", short: "Canteen", x: 4, y: 42, w: 18, h: 12, patterns: [/\bcanteen\b/, /\bcafeteria\b/, /\bcafe\b/, /\bmess\b/, /\bfood court\b/] },
  { id: "hostel", name: "Hostels", short: "Hostel", x: 26, y: 42, w: 24, h: 18, patterns: [/\bhostel/, /\bdorm/, /\bresidence\b/] },
  { id: "sports", name: "Sports Complex", short: "Sports", x: 54, y: 42, w: 22, h: 18, patterns: [/\bsports?\b/, /\bgym\b/, /\bground\b/, /\bcourt\b/, /\bstadium\b/] },
  { id: "parking", name: "Parking & Gates", short: "Parking", x: 80, y: 42, w: 16, h: 18, patterns: [/\bparking\b/, /\bgate\b/, /\bentrance\b/] },
];

const BY_ID = new Map(BUILDINGS.map((b) => [b.id, b]));

export function getBuilding(id: string | undefined | null): Building | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/**
 * Best-effort building for a free-text location ("Block B, Room 204").
 * Returns undefined when nothing matches — callers show such issues as
 * "unplaced" rather than guessing.
 */
export function matchBuilding(location: string | undefined | null): Building | undefined {
  const text = (location ?? "").toLowerCase();
  if (!text.trim()) return undefined;
  return BUILDINGS.find((b) => b.patterns.some((p) => p.test(text)));
}

/**
 * Building for an issue: an exact QR location wins, otherwise the text.
 * `locationBuildings` maps campusLocations ids to building ids.
 */
export function buildingForIssue(
  issue: { location: string; locationId?: string },
  locationBuildings: Map<string, string> = new Map()
): Building | undefined {
  const fromQr = issue.locationId ? getBuilding(locationBuildings.get(issue.locationId)) : undefined;
  return fromQr ?? matchBuilding(issue.location);
}

/** URL-safe id for a new campus location ("Block B Room 204" → "block-b-room-204"). */
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
