import { describe, expect, it } from "vitest";
import { BUILDINGS, CAMPUS_GRID } from "@/lib/campus";
import { LabelMarker, labelCollisions, labelWidth, layoutLabels } from "@/lib/mapLabels";

const bounds = { width: CAMPUS_GRID.width, height: CAMPUS_GRID.height };

/** The markers exactly as CampusMap builds them at a zoom level, with sample counts. */
function markers(zoom: number, selectedId: string | null = null, counts: Record<string, number> = { "blocks-1-2-5": 8, "blocks-3-4": 4, "sports-grounds": 2, "ghulam-ahmed-hall": 1, "college-of-pharmacy": 1, garden: 1 }): { list: LabelMarker[]; font: number } {
  const scale = 1 / Math.sqrt(zoom);
  const max = Math.max(0, ...Object.values(counts));
  return {
    font: 8.5 * scale,
    list: BUILDINGS.map((b) => ({ id: b.id, x: b.x, y: b.y, r: (10 + (max ? ((counts[b.id] ?? 0) / max) * 9 : 0)) * scale, text: b.short, pinned: selectedId === b.id, priority: counts[b.id] ?? 0 })),
  };
}

describe("campus map label placement", () => {
  it.each([1, 1.5, 2.25, 3.4, 5])("no two visible labels overlap, and none covers another marker, at zoom %s", (zoom) => {
    const { list, font } = markers(zoom);
    const labels = layoutLabels(list, font, bounds);
    expect(labels).toHaveLength(BUILDINGS.length); // every place has a label entry, shown or on demand
    expect(labelCollisions(labels)).toEqual([]);
    for (const l of labels.filter((x) => x.visible)) {
      for (const m of list) {
        if (m.id === l.id) continue;
        const hit = l.box.x0 < m.x + m.r && l.box.x1 > m.x - m.r && l.box.y0 < m.y + m.r && l.box.y1 > m.y - m.r;
        expect(hit, `${l.id} label over ${m.id} marker`).toBe(false);
      }
      expect(l.box.x0).toBeGreaterThanOrEqual(0);
      expect(l.box.y0).toBeGreaterThanOrEqual(0);
      expect(l.box.x1).toBeLessThanOrEqual(bounds.width);
      expect(l.box.y1).toBeLessThanOrEqual(bounds.height);
    }
  });

  it("shows most labels at the default zoom and all of them when zoomed in", () => {
    const at = (zoom: number) => layoutLabels(markers(zoom).list, markers(zoom).font, bounds).filter((l) => l.visible).length;
    expect(at(1)).toBeGreaterThanOrEqual(BUILDINGS.length - 2);
    expect(at(3.4)).toBe(BUILDINGS.length);
  });

  it("the Ghulam Ahmed Hall and Blocks 1, 2 and 5 labels no longer collide", () => {
    const { list, font } = markers(1);
    const labels = layoutLabels(list, font, bounds);
    const hall = labels.find((l) => l.id === "ghulam-ahmed-hall")!;
    const blocks = labels.find((l) => l.id === "blocks-1-2-5")!;
    expect(blocks.visible).toBe(true);
    if (hall.visible) expect(labelCollisions([hall, blocks])).toEqual([]);
  });

  it("the selected place always shows its label", () => {
    for (const b of BUILDINGS) {
      const { list, font } = markers(1, b.id);
      const labels = layoutLabels(list, font, bounds);
      expect(labels.find((l) => l.id === b.id)!.visible, b.id).toBe(true);
    }
  });

  it("is deterministic and independent of the order markers are given in", () => {
    const { list, font } = markers(1);
    const a = layoutLabels(list, font, bounds);
    const b = layoutLabels([...list].reverse(), font, bounds);
    expect(a).toEqual(layoutLabels(list, font, bounds));
    for (const l of a) expect(b.find((x) => x.id === l.id)).toEqual(l);
  });

  it("hides, rather than overlaps, when there is truly no room, unless pinned", () => {
    const crowd: LabelMarker[] = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, x: 100 + (i % 4) * 6, y: 100 + Math.floor(i / 4) * 6, r: 8, text: "A long place name", priority: i }));
    const labels = layoutLabels(crowd, 9, { width: 240, height: 220 });
    expect(labelCollisions(labels)).toEqual([]);
    expect(labels.some((l) => !l.visible)).toBe(true);
    const pinned = layoutLabels(crowd.map((m) => ({ ...m, pinned: m.id === "p0" })), 9, { width: 240, height: 220 });
    expect(pinned.find((l) => l.id === "p0")!.visible).toBe(true);
  });

  it("estimates label width from the text", () => {
    expect(labelWidth("Blocks 1 · 2 · 5", 8.5)).toBeGreaterThan(labelWidth("SBI", 8.5));
  });
});
