import { describe, expect, it } from "vitest";
import { IssueSummary } from "@/types";
import { analyzeIssueDetails, heuristicConfidence, summarizeReport } from "@/services/aiService";
import { DEPARTMENTS } from "@/lib/constants";
import { matchBuilding, buildingForIssue, slugifyLocation, describeLocation } from "@/lib/campus";
import {
  confirmedClusters,
  findDuplicates,
  issueSimilarity,
  suggestClusters,
  tokenize,
} from "@/lib/intelligence/similarity";
import { DEFAULT_SLA_CONFIG, computeSla, describeSla, normalizeSlaConfig, validateSlaHours } from "@/lib/intelligence/sla";
import {
  applyFilters,
  categoryDistribution,
  hotspots,
  resolutionByCategory,
  resolutionStats,
  slaSummary,
  statusCounts,
  timeSeries,
  workerWorkload,
} from "@/lib/intelligence/analytics";
import { maintenanceRisk, riskLevel } from "@/lib/intelligence/maintenance";
import { averageRatings, recommendWorkers } from "@/lib/intelligence/assignment";
import { generateInsights } from "@/lib/intelligence/insights";
import { searchIssues } from "@/lib/search";
import { csvCell, toCsv, toJson } from "@/lib/export";
import { parseDateInput, resolveRange, semesterStart, toDateInput } from "@/lib/intelligence/ranges";

const NOW = new Date("2026-10-03T12:00:00Z");
const H = 3_600_000;
const D = 24 * H;
let seq = 0;

function issue(overrides: Partial<IssueSummary> = {}): IssueSummary {
  seq++;
  return {
    id: `i${seq}`,
    title: "Broken light",
    category: "Electrical",
    priority: "Medium",
    status: "Open",
    location: "Block A, Room 101",
    locationId: "",
    assignedTo: "",
    duplicateOf: "",
    createdAt: new Date(NOW.getTime() - D),
    ...overrides,
  };
}

// ------------------------------------------------------------------
describe("AI issue intelligence", () => {
  it("classifies, explains and suggests a department", () => {
    const r = analyzeIssueDetails({
      title: "Socket not working",
      description: "The power socket near the projector has no power",
      location: "Lab 204",
    });
    expect(r.category).toBe("Electrical");
    expect(r.explanation).toMatch(/Classified as Electrical because the report mentions "socket"/);
    expect(r.explanation).toContain("Lab 204");
    expect(r.department).toBe("Electrical Maintenance");
    expect(DEPARTMENTS).toContain(r.department);
  });

  it("explains the priority keyword", () => {
    expect(analyzeIssueDetails({ title: "Exposed wire", description: "dangerous, urgent" }).explanation).toMatch(/Priority High because of "urgent"/);
  });

  it("falls back to General with low confidence when nothing matches", () => {
    const r = analyzeIssueDetails({ title: "Something odd", description: "Please look into it" });
    expect(r.category).toBe("General");
    expect(r.confidence).toBe(0.3);
    expect(r.explanation).toMatch(/No category keywords matched/);
    expect(r.department).toBe("Facilities Helpdesk");
  });

  it("never throws on hostile or empty input", () => {
    expect(() => analyzeIssueDetails({})).not.toThrow();
    expect(() => analyzeIssueDetails({ title: 42, description: null, location: {} })).not.toThrow();
  });

  it("confidence is a bounded heuristic that rises with support and falls with ambiguity", () => {
    expect(heuristicConfidence(0, 0)).toBe(0.3);
    expect(heuristicConfidence(3, 3)).toBeGreaterThan(heuristicConfidence(1, 1));
    expect(heuristicConfidence(2, 4)).toBeLessThan(heuristicConfidence(2, 2));
    for (const [w, t] of [[1, 1], [5, 5], [10, 10], [1, 9]]) {
      const c = heuristicConfidence(w, t);
      expect(c).toBeGreaterThanOrEqual(0.3);
      expect(c).toBeLessThanOrEqual(0.95);
    }
  });

  it("summarises only long reports, using a sentence from the report", () => {
    expect(summarizeReport("Short report.")).toBe("");
    const long =
      "I was in the lab this morning for the practical session with my group. " +
      "The air conditioner in Lab 204 has stopped cooling completely and the room is very hot. " +
      "Several students left early because of the heat and we could not finish.";
    const summary = summarizeReport(long, ["air conditioner"]);
    expect(summary).toBe("The air conditioner in Lab 204 has stopped cooling completely and the room is very hot.");
    expect(long).toContain(summary);
  });

  it("truncates an overlong summary sentence at a word boundary", () => {
    const sentence = `${"word ".repeat(60)}end.`;
    const s = summarizeReport(sentence);
    expect(s.length).toBeLessThanOrEqual(161);
    expect(s.endsWith("…")).toBe(true);
  });
});

// ------------------------------------------------------------------
describe("campus layout", () => {
  it("matches buildings from free text", () => {
    expect(matchBuilding("Block B, Room 204")?.id).toBe("block-b");
    expect(matchBuilding("near the B block stairs")?.id).toBe("block-b");
    expect(matchBuilding("Lab 204")?.id).toBe("labs");
    expect(matchBuilding("Central library 2nd floor")?.id).toBe("library");
    expect(matchBuilding("Boys hostel")?.id).toBe("hostel");
  });

  it("does not invent a building for unknown places", () => {
    expect(matchBuilding("Unknown")).toBeUndefined();
    expect(matchBuilding("")).toBeUndefined();
    expect(matchBuilding("somewhere near the big tree")).toBeUndefined();
  });

  it("prefers the QR location's building over the text", () => {
    const map = new Map([["lib-101", "library"]]);
    expect(buildingForIssue({ location: "Block A", locationId: "lib-101" }, map)?.id).toBe("library");
    expect(buildingForIssue({ location: "Block A", locationId: "unknown-id" }, map)?.id).toBe("block-a");
  });

  it("slugifies and describes locations", () => {
    expect(slugifyLocation("Block B — Room 204!")).toBe("block-b-room-204");
    expect(describeLocation({ name: "Physics Lab", buildingId: "labs", floor: "2", room: "204" })).toBe(
      "Physics Lab, Laboratory Complex, Floor 2, Room 204"
    );
  });
});

// ------------------------------------------------------------------
describe("duplicate detection", () => {
  it("folds synonyms", () => {
    expect(tokenize("Air conditioner stopped cooling")).toEqual(tokenize("AC not working"));
    expect(tokenize("WiFi down").has("network")).toBe(true);
  });

  it("recognises the same problem phrased differently", () => {
    const a = issue({ title: "AC not working in Lab 204", location: "Lab 204", category: "Electrical" });
    const b = issue({ title: "Lab 204 air conditioner stopped cooling", location: "Lab 204", category: "Electrical" });
    expect(issueSimilarity(a, b)).toBeGreaterThanOrEqual(0.55);
  });

  it("does not match unrelated reports or the same problem elsewhere", () => {
    const a = issue({ title: "AC not working", location: "Lab 204" });
    expect(issueSimilarity(a, issue({ title: "Garbage near canteen", location: "Canteen", category: "Cleanliness" }))).toBeLessThan(0.3);
    expect(issueSimilarity(a, issue({ title: "AC not working", location: "Hostel", category: "Electrical" }))).toBeLessThan(0.75);
  });

  it("findDuplicates ignores resolved and old issues and ranks best first", () => {
    const candidate = { title: "Lab 204 AC failure", category: "Electrical", location: "Lab 204", locationId: "" };
    const strong = issue({ title: "AC not working in Lab 204", location: "Lab 204" });
    const resolved = issue({ title: "AC not working in Lab 204", location: "Lab 204", status: "Resolved" });
    const old = issue({ title: "AC not working in Lab 204", location: "Lab 204", createdAt: new Date(NOW.getTime() - 30 * D) });
    const unrelated = issue({ title: "Leaking tap", location: "Hostel", category: "Plumbing" });
    const matches = findDuplicates(candidate, [unrelated, old, resolved, strong], NOW);
    expect(matches.map((m) => m.issue.id)).toEqual([strong.id]);
  });

  it("same QR location counts as the same place", () => {
    const a = issue({ title: "Projector broken", location: "x", locationId: "lab-204" });
    const b = issue({ title: "Projector not working", location: "y", locationId: "lab-204" });
    expect(issueSimilarity(a, b)).toBeGreaterThanOrEqual(0.55);
  });
});

// ------------------------------------------------------------------
describe("incident clusters", () => {
  it("groups confirmed links under their master issue", () => {
    const master = issue({ title: "Lab 204 AC failure", createdAt: new Date(NOW.getTime() - 5 * H) });
    const r1 = issue({ duplicateOf: master.id, createdAt: new Date(NOW.getTime() - 3 * H) });
    const r2 = issue({ duplicateOf: master.id, createdAt: new Date(NOW.getTime() - 1 * H) });
    const orphan = issue({ duplicateOf: "missing-master" });
    const [cluster, ...rest] = confirmedClusters([master, r1, r2, orphan]);
    expect(rest).toHaveLength(0);
    expect(cluster.masterIssueId).toBe(master.id);
    expect(cluster.relatedIssueIds.sort()).toEqual([r1.id, r2.id].sort());
    expect(cluster.reportCount).toBe(3);
    expect(cluster.firstReportedAt).toEqual(master.createdAt);
    expect(cluster.lastReportedAt).toEqual(r2.createdAt);
  });

  it("suggests clusters only among unlinked, unresolved, similar reports", () => {
    const a = issue({ title: "AC not working in Lab 204", location: "Lab 204", createdAt: new Date(NOW.getTime() - 4 * H) });
    const b = issue({ title: "Lab 204 air conditioner stopped cooling", location: "Lab 204", createdAt: new Date(NOW.getTime() - H) });
    const c = issue({ title: "Garbage overflow", location: "Canteen", category: "Cleanliness" });
    const done = issue({ title: "AC not working in Lab 204", location: "Lab 204", status: "Resolved" });
    const clusters = suggestClusters([a, b, c, done]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].masterIssueId).toBe(a.id);
    expect(clusters[0].relatedIssueIds).toEqual([b.id]);
  });

  it("never suggests a confirmed incident's main report as a member (no chained incidents)", () => {
    const a = issue({ title: "AC not working in Lab 204", location: "Lab 204", createdAt: new Date(NOW.getTime() - 6 * H) });
    const master = issue({ title: "Lab 204 AC stopped cooling", location: "Lab 204", createdAt: new Date(NOW.getTime() - 5 * H) });
    const linked = issue({ title: "Lab 204 AC broken", location: "Lab 204", duplicateOf: master.id, createdAt: new Date(NOW.getTime() - 4 * H) });
    const clusters = suggestClusters([a, master, linked]);
    expect(clusters.flatMap((c) => c.relatedIssueIds)).not.toContain(master.id);
    expect(clusters.map((c) => c.masterIssueId)).not.toContain(master.id);
  });
});

// ------------------------------------------------------------------
describe("SLA engine", () => {
  const created = new Date(NOW.getTime() - 5 * H);

  it("computes on-track, approaching and breached for open issues", () => {
    expect(computeSla({ createdAt: new Date(NOW.getTime() - H), priority: "High", status: "Open" }, DEFAULT_SLA_CONFIG, NOW).state).toBe("on-track");
    expect(computeSla({ createdAt: created, priority: "High", status: "In Progress" }, DEFAULT_SLA_CONFIG, NOW).state).toBe("approaching");
    const breached = computeSla({ createdAt: new Date(NOW.getTime() - 7 * H), priority: "High", status: "Open" }, DEFAULT_SLA_CONFIG, NOW);
    expect(breached.state).toBe("breached");
    expect(breached.remainingMs).toBe(-H);
    expect(describeSla(breached)).toBe("1h 0m overdue");
  });

  it("marks resolved issues met or missed from their own timestamps", () => {
    expect(computeSla({ createdAt: created, priority: "High", status: "Resolved", resolvedAt: new Date(created.getTime() + 2 * H) }, DEFAULT_SLA_CONFIG, NOW).state).toBe("met");
    expect(computeSla({ createdAt: created, priority: "High", status: "Resolved", resolvedAt: new Date(created.getTime() + 9 * H) }, DEFAULT_SLA_CONFIG, NOW).state).toBe("missed");
  });

  it("uses the configured targets", () => {
    const strict = normalizeSlaConfig({ High: 1, Medium: 2, Low: 3 });
    expect(computeSla({ createdAt: new Date(NOW.getTime() - 2 * H), priority: "High", status: "Open" }, strict, NOW).state).toBe("breached");
  });

  it("ignores invalid saved values", () => {
    const cfg = normalizeSlaConfig({ High: -5, Medium: "24", Low: 99999 });
    expect(cfg.hours).toEqual({ High: 6, Medium: 24, Low: 72 });
    expect(normalizeSlaConfig(null).isDefault).toBe(true);
  });

  it("validates admin input", () => {
    expect(validateSlaHours({ High: 4, Medium: 12, Low: 48 })).toBeNull();
    expect(validateSlaHours({ High: 0, Medium: 12, Low: 48 })).toMatch(/High/);
    expect(validateSlaHours({ High: 4.5, Medium: 12, Low: 48 })).toMatch(/whole/);
    expect(validateSlaHours({ High: 48, Medium: 12, Low: 72 })).toMatch(/shorter/);
  });
});

// ------------------------------------------------------------------
describe("analytics", () => {
  const list = [
    issue({ category: "Electrical", status: "Resolved", priority: "High", createdAt: new Date(NOW.getTime() - 10 * H), resolvedAt: new Date(NOW.getTime() - 8 * H), assignedTo: "w1", location: "Block A" }),
    issue({ category: "Electrical", status: "Resolved", createdAt: new Date(NOW.getTime() - 10 * H), resolvedAt: new Date(NOW.getTime() - 4 * H), assignedTo: "w1", location: "Block A" }),
    issue({ category: "Plumbing", status: "In Progress", assignedTo: "w2", location: "Hostel" }),
    issue({ category: "Plumbing", status: "Open", location: "Unknown" }),
  ];

  it("counts by status and category", () => {
    expect(statusCounts(list)).toEqual({ Open: 1, "In Progress": 1, Resolved: 2 });
    expect(categoryDistribution(list)).toEqual([{ name: "Electrical", value: 2 }, { name: "Plumbing", value: 2 }]);
  });

  it("computes average and median resolution time from real timestamps", () => {
    expect(resolutionStats(list)).toEqual({ count: 2, averageHours: 4, medianHours: 4 });
    expect(resolutionStats([]).averageHours).toBeNull();
    expect(resolutionByCategory(list)).toEqual([{ name: "Electrical", averageHours: 4, count: 2 }]);
  });

  it("filters by category, status, priority, worker and building", () => {
    expect(applyFilters(list, { category: "Plumbing" })).toHaveLength(2);
    expect(applyFilters(list, { status: "Resolved", priority: "High" })).toHaveLength(1);
    expect(applyFilters(list, { workerId: "w1" })).toHaveLength(2);
    expect(applyFilters(list, { buildingId: "hostel" })).toHaveLength(1);
    expect(applyFilters(list, { department: "Plumbing & Water" })).toHaveLength(2);
  });

  it("builds a time series with empty buckets", () => {
    const series = timeSeries(list, new Date(NOW.getTime() - 3 * D), NOW, "day");
    expect(series).toHaveLength(4);
    expect(series.reduce((s, b) => s + b.reported, 0)).toBe(4);
    expect(series.reduce((s, b) => s + b.resolved, 0)).toBe(2);
  });

  it("aggregates hotspots and counts unplaced issues separately", () => {
    const { buildings, unplaced } = hotspots(list);
    expect(unplaced).toBe(1);
    expect(buildings.find((b) => b.buildingId === "block-a")).toMatchObject({ total: 2, open: 0, resolved: 2, topCategory: "Electrical" });
    expect(buildings.find((b) => b.buildingId === "library")).toMatchObject({ total: 0, topCategory: null, averageResolutionHours: null });
  });

  it("computes worker workload", () => {
    const loads = workerWorkload(list);
    expect(loads.find((l) => l.workerId === "w1")).toMatchObject({ active: 0, resolved: 2, resolvedByCategory: { Electrical: 2 } });
    expect(loads.find((l) => l.workerId === "w2")).toMatchObject({ active: 1, resolved: 0 });
  });

  it("summarises SLA state, most urgent first", () => {
    const urgent = issue({ priority: "High", createdAt: new Date(NOW.getTime() - 10 * H) });
    const soon = issue({ priority: "High", createdAt: new Date(NOW.getTime() - 5 * H) });
    const fine = issue({ priority: "Low", createdAt: new Date(NOW.getTime() - H) });
    const s = slaSummary([fine, soon, urgent], DEFAULT_SLA_CONFIG, NOW);
    expect(s.counts).toMatchObject({ breached: 1, approaching: 1, "on-track": 1 });
    expect(s.alerts.map((a) => a.issue.id)).toEqual([urgent.id, soon.id]);
  });
});

// ------------------------------------------------------------------
describe("maintenance risk indicator", () => {
  it("refuses to score without enough history", () => {
    const r = maintenanceRisk([issue(), issue()], NOW);
    expect(r.sufficient).toBe(false);
    if (!r.sufficient) expect(r.reason).toMatch(/Not enough history/);
  });

  it("refuses when the history is too short even with many issues", () => {
    const many = Array.from({ length: 12 }, () => issue({ createdAt: new Date(NOW.getTime() - 2 * D) }));
    const r = maintenanceRisk(many, NOW);
    expect(r.sufficient).toBe(false);
  });

  it("ranks a place with frequent, recurring, recent, severe issues as High", () => {
    const hot = Array.from({ length: 8 }, (_, k) =>
      issue({ title: "Leak", category: "Plumbing", priority: k < 4 ? "High" : "Medium", location: "Block B Restroom 2", createdAt: new Date(NOW.getTime() - (k * 3 + 1) * D) })
    );
    const calm = Array.from({ length: 3 }, (_, k) =>
      issue({ category: k === 0 ? "Electrical" : k === 1 ? "Furniture" : "IT", priority: "Low", location: "Library", createdAt: new Date(NOW.getTime() - (60 + k) * D) })
    );
    const r = maintenanceRisk([...hot, ...calm], NOW);
    expect(r.sufficient).toBe(true);
    if (!r.sufficient) return;
    expect(r.indicators[0]).toMatchObject({ level: "High", repeatedCategory: "Plumbing", issuesLast30Days: 8, buildingId: "block-b" });
    expect(r.indicators[0].label).toBe("Block B — 2");
    const library = r.indicators.find((i) => i.buildingId === "library");
    expect(library?.level).toBe("Low");
    expect(library?.repeatedCategory).toBeNull();
  });

  it("maps scores to levels", () => {
    expect(riskLevel(0.7)).toBe("High");
    expect(riskLevel(0.4)).toBe("Medium");
    expect(riskLevel(0.1)).toBe("Low");
  });
});

// ------------------------------------------------------------------
describe("worker recommendation", () => {
  const workers = [{ id: "w1", name: "Ahmed" }, { id: "w2", name: "Bina" }, { id: "w3", name: "Chen" }];
  const loads = workerWorkload([
    ...Array.from({ length: 4 }, () => issue({ assignedTo: "w1", status: "Resolved", category: "Electrical", resolvedAt: NOW })),
    issue({ assignedTo: "w1", status: "In Progress" }),
    ...Array.from({ length: 6 }, () => issue({ assignedTo: "w2", status: "In Progress" })),
  ]);

  it("prefers category experience and spare capacity, and explains why", () => {
    const [first] = recommendWorkers({ category: "Electrical" }, workers, loads);
    expect(first.workerId).toBe("w1");
    expect(first.reason).toMatch(/Resolved 4 Electrical issues · 1 active task/);
  });

  it("falls back to workload when nobody has history in the category", () => {
    const ranked = recommendWorkers({ category: "Plumbing" }, workers, loads);
    expect(ranked[0].workerId).toBe("w3");
    expect(ranked[0].reason).toMatch(/No Plumbing history yet — no active tasks/);
    expect(ranked.at(-1)?.workerId).toBe("w2");
  });

  it("uses ratings only when there are at least two", () => {
    const ratings = averageRatings([
      { issueId: "a", rating: 5, comment: "", createdBy: "s", assignedTo: "w3", category: "IT", createdAt: NOW },
      { issueId: "b", rating: 4, comment: "", createdBy: "s", assignedTo: "w3", category: "IT", createdAt: NOW },
      { issueId: "c", rating: 1, comment: "", createdBy: "s", assignedTo: "w2", category: "IT", createdAt: NOW },
    ]);
    expect(ratings.get("w3")).toEqual({ average: 4.5, count: 2 });
    const ranked = recommendWorkers({ category: "IT" }, workers, [], ratings);
    expect(ranked.find((r) => r.workerId === "w3")?.averageRating).toBe(4.5);
    expect(ranked.find((r) => r.workerId === "w2")?.averageRating).toBeNull();
  });
});

// ------------------------------------------------------------------
describe("factual insights", () => {
  it("says when there isn't enough data instead of inventing numbers", () => {
    const insights = generateInsights([issue()], 30, DEFAULT_SLA_CONFIG, NOW);
    expect(insights.find((i) => i.id === "trend")?.hasData).toBe(false);
    expect(insights.find((i) => i.id === "building")?.hasData).toBe(false);
    expect(insights.find((i) => i.id === "slowest")?.hasData).toBe(false);
  });

  it("computes the category trend against the previous period", () => {
    const prev = Array.from({ length: 5 }, () => issue({ category: "Electrical", createdAt: new Date(NOW.getTime() - 40 * D) }));
    const curr = Array.from({ length: 6 }, () => issue({ category: "Electrical", createdAt: new Date(NOW.getTime() - 5 * D) }));
    const trend = generateInsights([...prev, ...curr], 30, DEFAULT_SLA_CONFIG, NOW).find((i) => i.id === "trend");
    expect(trend?.text).toBe("Electrical issues increased by 20% compared with the previous 30-day period (5 → 6).");
  });

  it("names the building with the most unresolved issues", () => {
    const list = Array.from({ length: 3 }, () => issue({ location: "Block B" }));
    expect(generateInsights(list, 30, DEFAULT_SLA_CONFIG, NOW).find((i) => i.id === "building")?.text).toBe("Block B has the most unresolved issues (3).");
  });
});

// ------------------------------------------------------------------
describe("search", () => {
  const list = [
    issue({ id: "AbCdEf123", title: "Projector broken", location: "Lab 204", category: "IT" }),
    issue({ title: "WiFi down in library", location: "Library", category: "IT", status: "Resolved" }),
    issue({ title: "Leaking tap", location: "Hostel", category: "Plumbing" }),
  ];

  it("finds by issue id or prefix first", () => {
    expect(searchIssues(list, "#abcdef123")[0].issue.id).toBe("AbCdEf123");
    expect(searchIssues(list, "abcd")[0].issue.id).toBe("AbCdEf123");
  });

  it("matches title, location and synonyms", () => {
    expect(searchIssues(list, "internet").map((h) => h.issue.title)).toEqual(["WiFi down in library"]);
    expect(searchIssues(list, "hostel")[0].issue.title).toBe("Leaking tap");
  });

  it("applies filters and returns nothing for no match", () => {
    expect(searchIssues(list, "", { category: "IT", status: "Open" })).toHaveLength(1);
    expect(searchIssues(list, "zzzz-nothing")).toHaveLength(0);
  });
});

// ------------------------------------------------------------------
describe("exports", () => {
  it("escapes CSV cells and neutralises spreadsheet formulas", () => {
    expect(csvCell('a "quoted", value')).toBe('"a ""quoted"", value"');
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell(null)).toBe("");
  });

  it("builds CSV and JSON from columns", () => {
    const rows = [{ id: "1", n: 2 }];
    const cols = [{ header: "ID", value: (r: { id: string }) => r.id }, { header: "N", value: (r: { n: number }) => r.n }];
    expect(toCsv(rows, cols as never)).toBe("ID,N\r\n1,2");
    expect(JSON.parse(toJson(rows, cols as never))).toEqual([{ ID: "1", N: 2 }]);
  });
});

// ------------------------------------------------------------------
describe("analytics date ranges", () => {
  it("resolves presets relative to now", () => {
    const r = resolveRange("7d", NOW);
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(NOW.getTime() - r.from.getTime()).toBe(7 * D);
      expect(r.to).toEqual(NOW);
    }
  });

  it("uses Jan–Jun / Jul–Dec semesters", () => {
    expect(semesterStart(new Date(2026, 9, 3))).toEqual(new Date(2026, 6, 1));
    expect(semesterStart(new Date(2026, 2, 15))).toEqual(new Date(2026, 0, 1));
  });

  it("validates custom ranges", () => {
    expect(resolveRange("custom", NOW, { from: "", to: "2026-10-01" })).toEqual({ error: "Choose both a start and an end date." });
    expect(resolveRange("custom", NOW, { from: "2026-10-02", to: "2026-10-01" })).toHaveProperty("error");
    expect(resolveRange("custom", NOW, { from: "2024-01-01", to: "2026-10-01" })).toHaveProperty("error");
    expect(resolveRange("custom", NOW, { from: "2026-02-30", to: "2026-03-01" })).toHaveProperty("error");
    const ok = resolveRange("custom", NOW, { from: "2026-09-01", to: "2026-09-30" });
    expect(ok).not.toHaveProperty("error");
    if (!("error" in ok)) {
      expect(ok.from).toEqual(new Date(2026, 8, 1));
      expect(ok.to.getDate()).toBe(30);
      expect(ok.to.getHours()).toBe(23);
    }
    expect(toDateInput(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(parseDateInput("2026-1-5")).toBeNull();
  });
});
