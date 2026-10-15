import { beforeEach, describe, expect, it, vi } from "vitest";

// The signed-in QR lookup, with Firestore replaced by spies: a malformed
// identifier must be refused before any database request is made.
const fs = vi.hoisted(() => ({
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn((_db: unknown, ...p: string[]) => ({ path: p.join("/") })),
}));
vi.mock("@/lib/firebase", () => ({ db: { fake: true } }));
vi.mock("firebase/firestore", () => ({
  ...fs,
  collection: vi.fn(),
  query: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
}));

import { getCampusLocation, qrReportUrl } from "@/lib/locations";
import { isLocationIdShape } from "@/lib/sharedRules";
import { CAMPUS_LOCATIONS, getCanonicalLocation } from "@/lib/campus";
import { createDemoState, resolveDemoLocation } from "@/lib/viewer/demoStore";

beforeEach(() => {
  fs.getDoc.mockReset();
  fs.doc.mockClear();
});

const BAD = ["", " ", "Block-4", "BLOCK-4", "block_4", "block 4", "block-4 ", "a".repeat(61), "../admin", "..%2Fadmin", "<script>", "block-4;drop", "block-4\n", "блок-4", "mjcet-block-1‮", "mjcet-block-1\u0000"];

describe("QR location identifiers", () => {
  it("accept only lower-case letters, digits and hyphens, 1 to 60 long", () => {
    for (const id of ["mjcet-block-1", "a", "a".repeat(60), "blocks-3-4-staff-room-12"]) expect(isLocationIdShape(id), id).toBe(true);
    for (const id of BAD) expect(isLocationIdShape(id), JSON.stringify(id)).toBe(false);
    for (const id of [null, undefined, 4, {}, [], ["mjcet-block-1"]]) expect(isLocationIdShape(id as unknown)).toBe(false);
  });

  it("a malformed id never reaches Firestore", async () => {
    for (const id of BAD) expect(await getCampusLocation(id)).toBeNull();
    expect(fs.getDoc).not.toHaveBeenCalled();
    expect(fs.doc).not.toHaveBeenCalled();
  });

  it("a well-formed unknown id costs one lookup and resolves to nothing", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => false });
    expect(await getCampusLocation("no-such-place")).toBeNull();
    expect(fs.getDoc).toHaveBeenCalledTimes(1);
    expect(fs.doc.mock.calls[0].slice(1)).toEqual(["campusLocations", "no-such-place"]);
  });

  it("a known id resolves to that location's own record", async () => {
    fs.getDoc.mockResolvedValue({ exists: () => true, id: "mjcet-seminar-hall", data: () => ({ name: "Seminar Hall, Block 4", buildingId: "blocks-3-4", floor: "", room: "", createdAt: new Date() }) });
    const loc = await getCampusLocation("mjcet-seminar-hall");
    expect(loc).toMatchObject({ id: "mjcet-seminar-hall", name: "Seminar Hall, Block 4", buildingId: "blocks-3-4" });
  });

  it("the printed link carries only the id (no user data, no secret)", () => {
    const url = qrReportUrl("https://example.test/", "mjcet-seminar-hall");
    expect(url).toBe("https://example.test/dashboard/report?location=mjcet-seminar-hall");
    expect(new URL(url).searchParams.size).toBe(1);
    // A hostile id is encoded, so it can't add parameters.
    expect(new URL(qrReportUrl("https://example.test", "a&role=admin")).searchParams.get("role")).toBeNull();
  });

  it("every researched location has an id that passes the shape rule, and the demo resolves exactly those", () => {
    const state = createDemoState(new Date("2026-10-09T10:00:00Z"));
    for (const l of CAMPUS_LOCATIONS) {
      expect(isLocationIdShape(l.id), l.id).toBe(true);
      expect(getCanonicalLocation(l.id)?.name).toBe(l.name);
      // The unverified bank is a researched record but gets no sample issues, and is not a demo reporting place.
      if (l.id !== "sbi-as-mapped") expect(resolveDemoLocation(state, l.id)?.name, l.id).toBe(l.name);
    }
    for (const id of BAD) expect(resolveDemoLocation(state, id)).toBeUndefined();
  });

  it("the place's confidence is never stronger than its dataset record", () => {
    const state = createDemoState(new Date("2026-10-09T10:00:00Z"));
    for (const l of CAMPUS_LOCATIONS) {
      const demo = resolveDemoLocation(state, l.id);
      if (demo) expect(demo.verificationStatus).toBe(l.verificationStatus);
    }
  });
});
