import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { COLLEGE_OPTIONS, OTHER_VALUE, branchOptions, collegeId, exactOption, rankOptions } from "@/lib/academics";
import { normalizePhone, phoneError, samePhone } from "@/lib/phone";
import { sanitizeOtpInput } from "@/lib/validation";
import { DEPARTMENTS } from "@/lib/constants";
import institutions from "@/data/campuses/sues-hyderabad/institutions.json";

const labels = (xs: { label: string }[]) => xs.map((x) => x.label);

describe("college list", () => {
  it("is exactly the campus institutions, each once, with unique names", () => {
    expect(COLLEGE_OPTIONS).toHaveLength(institutions.institutions.length);
    expect(new Set(COLLEGE_OPTIONS.map((o) => o.value)).size).toBe(COLLEGE_OPTIONS.length);
    expect(COLLEGE_OPTIONS.map((o) => o.value)).not.toContain(OTHER_VALUE);
  });

  it("finds a college by its short name, id or full name, best match first", () => {
    expect(rankOptions(COLLEGE_OPTIONS, "mjcet")[0].label).toContain("Muffakham");
    expect(rankOptions(COLLEGE_OPTIONS, "phar")[0].label).toContain("Pharmacy");
    expect(rankOptions(COLLEGE_OPTIONS, "law")[0].label).toContain("Law");
    expect(rankOptions(COLLEGE_OPTIONS, "mu")[0].label).toContain("Muffakham");
    expect(rankOptions(COLLEGE_OPTIONS, "  SULTAN ").length).toBeGreaterThan(1);
  });
});

describe("rankOptions", () => {
  const opts = ["Alpha Beta", "Beta", "Gamma Beta Delta", "Delta", "xbetax"].map((l) => ({ value: l, label: l }));

  it("orders prefix, then word-start, then contains, keeping list order within a rank", () => {
    expect(labels(rankOptions(opts, "beta"))).toEqual(["Beta", "Alpha Beta", "Gamma Beta Delta", "xbetax"]);
  });

  it("returns everything for an empty or blank query, and nothing for a miss", () => {
    expect(rankOptions(opts, "")).toBe(opts);
    expect(rankOptions(opts, "   ")).toBe(opts);
    expect(rankOptions(opts, "zzz")).toEqual([]);
  });

  it("ignores case, accents and punctuation", () => {
    const o = [{ value: "a", label: "Computer Science and Engineering (AI & ML)" }];
    expect(rankOptions(o, "ai ml")).toHaveLength(1);
    expect(rankOptions(o, "COMPUTER")).toHaveLength(1);
    expect(rankOptions([{ value: "c", label: "Café Studies" }], "cafe")).toHaveLength(1);
  });

  it("matches an exact name only when the whole name was typed", () => {
    expect(exactOption(opts, "  delta ")?.value).toBe("Delta");
    expect(exactOption(opts, "Del")).toBeUndefined();
    expect(exactOption(opts, "")).toBeUndefined();
  });
});

describe("branch data", () => {
  it("lists MJCET's current branches (with the earlier ones marked) and nothing invented for others", () => {
    const mjcet = branchOptions("Muffakham Jah College of Engineering and Technology");
    expect(labels(mjcet)).toContain("Civil Engineering");
    expect(labels(mjcet)).toContain("Computer Science and Engineering (AI & ML)");
    expect(mjcet.find((b) => b.label === "Production Engineering")?.hint).toBe("Earlier programme");
    expect(branchOptions("Sultan-ul-Uloom College of Pharmacy")).toHaveLength(1);
    // Colleges without a sourced list have none: the person uses "isn't listed".
    expect(branchOptions("Sultan-Ul-Uloom Junior College")).toEqual([]);
    expect(branchOptions("Not a real college")).toEqual([]);
    expect(branchOptions("")).toEqual([]);
  });

  it("every branch entry belongs to a real campus college and has a source and review date", () => {
    const data = JSON.parse(readFileSync(join(process.cwd(), "data", "academics.json"), "utf8")) as { branches: Record<string, { source: string; checked: string; options: { label: string }[] }> };
    for (const [id, entry] of Object.entries(data.branches)) {
      expect(institutions.institutions.some((i) => i.id === id), id).toBe(true);
      expect(entry.source).toBeTruthy();
      expect(entry.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Set(entry.options.map((o) => o.label)).size).toBe(entry.options.length);
    }
    expect(collegeId("Muffakham Jah College of Engineering and Technology")).toBe("mjcet");
  });
});

describe("phone numbers", () => {
  it("reads a bare Indian mobile number as +91 and keeps explicit country codes", () => {
    expect(normalizePhone("98765 43210")).toBe("+919876543210");
    expect(normalizePhone("(98765) 43-210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });

  it("refuses anything that cannot be a number", () => {
    for (const bad of ["", "12345", "5876543210", "+0123456789", "+1", "abcdefghij", "98765 4321", "+91 98765 43210 99999", null, 12, undefined]) {
      expect(normalizePhone(bad as string), String(bad)).toBeNull();
    }
    expect(phoneError("")).toBeTruthy();
    expect(phoneError("98765 43210")).toBe("");
    expect(phoneError("nope")).toBeTruthy();
  });

  it("compares numbers in their normalised form", () => {
    expect(samePhone("98765 43210", "+91-9876543210")).toBe(true);
    expect(samePhone("98765 43210", "98765 43211")).toBe(false);
    expect(samePhone("x", "x")).toBe(false);
  });
});

describe("one-time code input", () => {
  it("keeps digits only, at most six", () => {
    expect(sanitizeOtpInput("12ab34")).toBe("1234");
    expect(sanitizeOtpInput("123 456 789")).toBe("123456");
    expect(sanitizeOtpInput("")).toBe("");
  });
});

describe("worker teams", () => {
  it("mirror the departments the rules accept", () => {
    const rules = readFileSync(join(process.cwd(), "firestore.rules"), "utf8");
    for (const d of DEPARTMENTS) expect(rules).toContain(`'${d}'`);
  });
});
