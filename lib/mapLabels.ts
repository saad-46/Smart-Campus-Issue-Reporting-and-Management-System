// ============================================
// Label placement for the campus map
// ============================================
// Several places sit close together (the official geotags are coarse), so
// labels drawn straight above every marker run into each other. This places
// each label in the first free position around its marker and hides a label
// only when no position is free. A hidden label is not a hidden place: the
// marker stays on the map, focusable, with its full name as its accessible
// name, and its label appears on hover, focus or selection.
//
// Pure and deterministic. Positions are in map units and depend only on the
// markers and the zoom level, never on the pan offset, so labels do not
// jitter while the map is dragged.

export interface LabelMarker {
  id: string;
  x: number;
  y: number;
  /** Drawn radius of the marker. */
  r: number;
  text: string;
  /** Higher is placed first (and so keeps the better position). */
  priority: number;
  /** Always shown, even if it has to overlap something. */
  pinned?: boolean;
}

export type LabelSide = "top" | "bottom" | "right" | "left" | "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface PlacedLabel {
  id: string;
  /** Text position. */
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  side: LabelSide;
  /** False when no free position was found; the caller shows it on demand only. */
  visible: boolean;
  box: Box;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const SIDES: LabelSide[] = ["top", "bottom", "right", "left", "top-right", "top-left", "bottom-right", "bottom-left"];

/** Approximate width of a label in map units (average glyph ≈ 0.56 em for the UI font at weight 600). */
export function labelWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.56 + fontSize * 0.5;
}

const overlaps = (a: Box, b: Box, gap = 0) => a.x0 < b.x1 + gap && a.x1 > b.x0 - gap && a.y0 < b.y1 + gap && a.y1 > b.y0 - gap;

function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

function candidate(m: LabelMarker, side: LabelSide, fontSize: number): Omit<PlacedLabel, "visible"> {
  const w = labelWidth(m.text, fontSize);
  const h = fontSize * 1.2;
  const pad = fontSize * 0.45;
  const d = m.r + pad;
  const diag = m.r * 0.72 + pad * 0.6;
  let x = m.x;
  let baseline = m.y;
  let anchor: PlacedLabel["anchor"] = "middle";
  switch (side) {
    case "top":
      baseline = m.y - d;
      break;
    case "bottom":
      baseline = m.y + d + h * 0.8;
      break;
    case "right":
      x = m.x + d;
      baseline = m.y + h * 0.3;
      anchor = "start";
      break;
    case "left":
      x = m.x - d;
      baseline = m.y + h * 0.3;
      anchor = "end";
      break;
    case "top-right":
      x = m.x + diag;
      baseline = m.y - diag;
      anchor = "start";
      break;
    case "top-left":
      x = m.x - diag;
      baseline = m.y - diag;
      anchor = "end";
      break;
    case "bottom-right":
      x = m.x + diag;
      baseline = m.y + diag + h * 0.8;
      anchor = "start";
      break;
    case "bottom-left":
      x = m.x - diag;
      baseline = m.y + diag + h * 0.8;
      anchor = "end";
      break;
  }
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "start" ? x : x - w;
  return { id: m.id, x, y: baseline, anchor, side, box: { x0, y0: baseline - h * 0.8, x1: x0 + w, y1: baseline + h * 0.2 } };
}

/**
 * Place one label per marker. `bounds` is the full map area; a label is not
 * placed where it would be cut off by it.
 */
export function layoutLabels(markers: LabelMarker[], fontSize: number, bounds: { width: number; height: number }): PlacedLabel[] {
  const markerBoxes = markers.map((m) => ({ id: m.id, box: { x0: m.x - m.r, y0: m.y - m.r, x1: m.x + m.r, y1: m.y + m.r } }));
  const order = [...markers].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.priority - a.priority || a.id.localeCompare(b.id));
  const placed: PlacedLabel[] = [];
  const gap = fontSize * 0.3;

  for (const m of order) {
    const inside = (b: Box) => b.x0 >= 0 && b.y0 >= 0 && b.x1 <= bounds.width && b.y1 <= bounds.height;
    const blocked = (b: Box) =>
      placed.some((p) => p.visible && overlaps(b, p.box, gap)) || markerBoxes.some((o) => o.id !== m.id && overlaps(b, o.box));
    const options = SIDES.map((side) => candidate(m, side, fontSize)).filter((c) => inside(c.box));
    const free = options.find((c) => !blocked(c.box));
    if (free) {
      placed.push({ ...free, visible: true });
      continue;
    }
    // Nothing is free. A pinned label takes the position that covers the least; others wait for hover or focus.
    const cost = (b: Box) => placed.reduce((sum, p) => sum + (p.visible ? overlapArea(b, p.box) : 0), 0) + markerBoxes.reduce((sum, o) => sum + (o.id === m.id ? 0 : overlapArea(b, o.box)), 0);
    const fallback = [...(options.length ? options : [candidate(m, "top", fontSize)])].sort((a, b) => cost(a.box) - cost(b.box))[0];
    placed.push({ ...fallback, visible: !!m.pinned });
  }
  const byId = new Map(placed.map((p) => [p.id, p]));
  return markers.map((m) => byId.get(m.id)!);
}

/** Pairs of visible labels that overlap (used by tests; an empty list is the goal). */
export function labelCollisions(labels: PlacedLabel[]): [string, string][] {
  const visible = labels.filter((l) => l.visible);
  const out: [string, string][] = [];
  for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) if (overlaps(visible[i].box, visible[j].box)) out.push([visible[i].id, visible[j].id]);
  return out;
}
