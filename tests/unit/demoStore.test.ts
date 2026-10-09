import { describe, expect, it, vi } from "vitest";

// Explore Mode must work without Firebase ever being loaded. If anything the
// demo engine imports reached these modules, importing it would throw here.
vi.mock("firebase/app", () => {
  throw new Error("Explore Mode loaded firebase/app");
});
vi.mock("firebase/auth", () => {
  throw new Error("Explore Mode loaded firebase/auth");
});
vi.mock("firebase/firestore", () => {
  throw new Error("Explore Mode loaded firebase/firestore");
});
vi.mock("@/lib/firebase", () => {
  throw new Error("Explore Mode loaded the Firebase app");
});

import { DemoAction, DemoState, applyDemoAction, createDemoState, demoBudget, demoWorkerName, hasWorkerAccess, resolveDemoLocation } from "@/lib/viewer/demoStore";
import { demoStats } from "@/lib/viewer/demoStats";
import { DEMO_BUDGET_TOTAL, DEMO_PERSONA, DemoRole, demoTimeline } from "@/lib/viewer/demoData";
import { demoActivity } from "@/lib/viewer/demoFeed";
import { isDemoId } from "@/lib/sharedRules";

const NOW = new Date("2026-10-09T10:00:00Z");
const LATER = new Date("2026-10-09T10:05:00Z");
const ME = DEMO_PERSONA.worker.id;

function act(state: DemoState, action: DemoAction, role: DemoRole, at = LATER) {
  const result = applyDemoAction(state, action, role, at);
  if (!result.ok) throw new Error(`refused: ${result.error}`);
  return result;
}
function refused(state: DemoState, action: DemoAction, role: DemoRole): string {
  const result = applyDemoAction(state, action, role, LATER);
  expect(result.ok).toBe(false);
  expect(result.state).toBe(state); // a refused action changes nothing
  return result.ok ? "" : result.error;
}
const issue = (s: DemoState, id: string) => s.data.issues.find((i) => i.id === id)!;
const stats = (s: DemoState) => demoStats(s.data, s.sla, { workers: s.workers, budget: demoBudget(s), locations: s.locations });
const report = { title: "Water leaking near the staircase", description: "Water is dripping from a ceiling pipe onto the stairs.", locationId: "mjcet-block-4", withPhoto: false };

describe("baseline", () => {
  it("is deterministic and made only of demo records", () => {
    const a = createDemoState(NOW);
    const b = createDemoState(NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.changes).toBe(0);
    expect(a.data.issues.length).toBeGreaterThan(100);
    for (const i of a.data.issues) expect(isDemoId(i.id), i.id).toBe(true);
    for (const list of Object.values(a.notifications)) for (const n of list) if (n.issueId) expect(isDemoId(n.issueId)).toBe(true);
    // Fictional people only: no e-mail addresses, phone numbers or receipt files anywhere in the state.
    const text = JSON.stringify(a);
    expect(text).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
    expect(text).not.toMatch(/data:image|https?:\/\//);
  });

  it("actions never mutate the state they were given", () => {
    const start = createDemoState(NOW);
    const frozen = JSON.stringify(start);
    let s = act(start, { type: "createIssue", report }, "student").state;
    s = act(s, { type: "assign", issueId: "SC-1146", workerId: ME }, "admin").state;
    s = act(s, { type: "addFunds", amount: 5000 }, "admin").state;
    expect(JSON.stringify(start)).toBe(frozen);
    expect(s.changes).toBe(3);
    // "Reset demo" is simply a fresh baseline.
    expect(JSON.stringify(createDemoState(NOW))).toBe(frozen);
  });
});

describe("issue lifecycle, end to end", () => {
  it("report → assign → start → resolve → claim → pay → rate, with every view following", () => {
    let s = createDemoState(NOW);
    const before = stats(s);

    const created = act(s, { type: "createIssue", report }, "student");
    s = created.state;
    expect(created.issueId).toBe("SC-1146");
    const fresh = issue(s, "SC-1146");
    expect(fresh).toMatchObject({ status: "Open", mine: true, simulated: true, locationId: "mjcet-block-4", location: "Block 4", category: "Plumbing" });
    expect(stats(s).total).toBe(before.total + 1);
    expect(stats(s).openCount).toBe(before.openCount + 1);
    expect(stats(s).unassigned).toBe(before.unassigned + 1);
    expect(stats(s).map.buildings.find((b) => b.buildingId === "blocks-3-4")!.open).toBe(before.map.buildings.find((b) => b.buildingId === "blocks-3-4")!.open + 1);
    expect(s.notifications.admin[0]).toMatchObject({ issueId: "SC-1146", read: false });
    expect(s.notifications.student[0].title).toBe("Report received");

    s = act(s, { type: "assign", issueId: "SC-1146", workerId: ME }, "admin").state;
    expect(issue(s, "SC-1146").assignedTo).toBe(ME);
    expect(s.notifications.worker[0].title).toBe("New task assigned to you");
    expect(stats(s).unassigned).toBe(before.unassigned);

    s = act(s, { type: "start", issueId: "SC-1146" }, "worker").state;
    expect(issue(s, "SC-1146").status).toBe("In Progress");
    s = act(s, { type: "resolve", issueId: "SC-1146", summary: "Replaced the leaking joint." }, "worker", new Date(LATER.getTime() + 60_000)).state;
    expect(issue(s, "SC-1146")).toMatchObject({ status: "Resolved", resolutionSummary: "Replaced the leaking joint." });
    expect(stats(s).openCount).toBe(before.openCount);

    s = act(s, { type: "submitClaim", issueId: "SC-1146", amount: "450.5", description: "Pipe joint" }, "worker").state;
    expect(issue(s, "SC-1146").claim).toMatchObject({ amount: 450.5, status: "pending" });
    expect(stats(s).finance.pendingCount).toBe(before.finance.pendingCount + 1);

    s = act(s, { type: "decideClaim", issueId: "SC-1146", decision: "approved" }, "admin").state;
    expect(stats(s).finance.spent).toBeCloseTo(before.finance.spent + 450.5);
    expect(stats(s).finance.transactions.some((t) => t.issueId === "SC-1146")).toBe(true);

    s = act(s, { type: "rate", issueId: "SC-1146", rating: 5, comment: "Quick fix" }, "student").state;
    expect(stats(s).satisfaction.count).toBe(before.satisfaction.count + 1);

    // The timeline and the campus activity feed show every simulated step.
    const steps = demoTimeline(issue(s, "SC-1146"), s.data.now).map((e) => e.type);
    expect(steps).toEqual(["reported", "assigned", "started", "resolved", "claim_approved", "feedback"]);
    expect(demoActivity(s.data).filter((a) => a.issue.id === "SC-1146")).toHaveLength(6);
  });

  it("follows the same forward-only lifecycle as the real app", () => {
    const s = createDemoState(NOW);
    expect(refused(s, { type: "resolve", issueId: "SC-1137", summary: "Done already" }, "worker")).toMatch(/in progress/);
    expect(refused(s, { type: "start", issueId: "SC-1136" }, "worker")).toMatch(/open issue/);
    expect(refused(s, { type: "start", issueId: "SC-1139" }, "worker")).toMatch(/belongs to/);
    expect(refused(s, { type: "assign", issueId: "SC-1125", workerId: ME }, "admin")).toMatch(/Resolved/);
    expect(refused(s, { type: "resolve", issueId: "SC-1136", summary: "ok" }, "worker")).toMatch(/at least 5/);
    expect(refused(s, { type: "start", issueId: "SC-9999" }, "worker")).toMatch(/isn't in the demo/);
  });

  it("validates a report like the real form and refuses unknown or malformed locations", () => {
    const s = createDemoState(NOW);
    expect(refused(s, { type: "createIssue", report: { ...report, title: "Hi" } }, "student")).toMatch(/title/);
    expect(refused(s, { type: "createIssue", report: { ...report, description: "short" } }, "student")).toMatch(/Describe/);
    for (const locationId of ["", "block-a", "mjcet-block-99", "../../etc/passwd", "<script>", "MJCET-BLOCK-4", "a".repeat(80)]) {
      expect(refused(s, { type: "createIssue", report: { ...report, locationId } }, "student")).toMatch(/known campus location/);
    }
    // A location with no known position is accepted and stays off the map.
    const lib = act(s, { type: "createIssue", report: { ...report, locationId: "mjcet-central-library" } }, "student").state;
    expect(stats(lib).map.unplaced).toBe(stats(s).map.unplaced + 1);
  });
});

describe("role restrictions (the perspective is not a privilege)", () => {
  const s = createDemoState(NOW);
  it.each<[string, DemoAction, DemoRole]>([
    ["a student assigning", { type: "assign", issueId: "SC-1145", workerId: ME }, "student"],
    ["a worker assigning someone else", { type: "assign", issueId: "SC-1145", workerId: "w03" }, "worker"],
    ["a worker taking an assigned task", { type: "assign", issueId: "SC-1139", workerId: ME }, "worker"],
    ["a student escalating", { type: "setEscalation", issueId: "SC-1145", escalated: true }, "student"],
    ["a worker unassigning", { type: "unassign", issueId: "SC-1137" }, "worker"],
    ["a student starting work", { type: "start", issueId: "SC-1137" }, "student"],
    ["an admin resolving", { type: "resolve", issueId: "SC-1136", summary: "Fixed it" }, "admin"],
    ["a worker paying a claim", { type: "decideClaim", issueId: "SC-1124", decision: "approved" }, "worker"],
    ["a student paying a claim", { type: "decideClaim", issueId: "SC-1124", decision: "approved" }, "student"],
    ["a worker adding funds", { type: "addFunds", amount: 100 }, "worker"],
    ["a student changing deadlines", { type: "saveSla", hours: { High: 1, Medium: 2, Low: 3 } }, "student"],
    ["a worker approving a worker", { type: "decideWorkerRequest", requestId: "r01", approve: true }, "worker"],
    ["a student removing a worker", { type: "removeWorker", workerId: "w03" }, "student"],
    ["a worker adding a location", { type: "addLocation", input: { name: "Staff room", buildingId: "", floor: "", room: "" } }, "worker"],
    ["a worker linking reports", { type: "link", issueId: "SC-1145", masterId: "SC-1139" }, "worker"],
    ["an admin rating a fix", { type: "rate", issueId: "SC-1123", rating: 5, comment: "" }, "admin"],
    ["a worker upvoting", { type: "toggleUpvote", issueId: "SC-1139" }, "worker"],
  ])("refuses %s", (_name, action, role) => {
    expect(refused(s, action, role)).toMatch(/perspective|belongs to|only take/);
  });

  it("a worker can take an unassigned open issue for themselves, exactly once", () => {
    const next = act(s, { type: "assign", issueId: "SC-1145", workerId: ME }, "worker").state;
    expect(issue(next, "SC-1145").assignedTo).toBe(ME);
    expect(refused(next, { type: "assign", issueId: "SC-1145", workerId: ME }, "worker")).toMatch(/belongs to/);
  });
});

describe("administrator actions", () => {
  it("escalates, clears and unassigns", () => {
    let s = createDemoState(NOW);
    s = act(s, { type: "setEscalation", issueId: "SC-1137", escalated: true }, "admin").state;
    expect(issue(s, "SC-1137").escalated).toBe(true);
    expect(refused(s, { type: "setEscalation", issueId: "SC-1137", escalated: true }, "admin")).toMatch(/already escalated/);
    s = act(s, { type: "setEscalation", issueId: "SC-1137", escalated: false }, "admin").state;
    s = act(s, { type: "unassign", issueId: "SC-1137" }, "admin").state;
    expect(issue(s, "SC-1137").assignedTo).toBe("");
    expect(refused(s, { type: "unassign", issueId: "SC-1137" }, "admin")).toMatch(/isn't assigned/);
    expect(demoTimeline(issue(s, "SC-1137"), s.data.now).map((e) => e.type)).toEqual(["reported"]);
  });

  it("links, unlinks and groups reports into incidents without chaining them", () => {
    let s = createDemoState(NOW);
    const incidents = stats(s).incidents.length;
    s = act(s, { type: "link", issueId: "SC-1145", masterId: "SC-1139" }, "admin").state;
    expect(issue(s, "SC-1145").duplicateOf).toBe("SC-1139");
    expect(stats(s).incidents.length).toBe(incidents + 1);
    expect(demoTimeline(issue(s, "SC-1145"), s.data.now).filter((e) => e.type === "linked")).toHaveLength(1);
    // Linking to a member links to that member's main report.
    s = act(s, { type: "link", issueId: "SC-1138", masterId: "SC-1145" }, "admin").state;
    expect(issue(s, "SC-1138").duplicateOf).toBe("SC-1139");
    expect(refused(s, { type: "link", issueId: "SC-1139", masterId: "SC-1130" }, "admin")).toMatch(/already has linked reports/);
    expect(refused(s, { type: "link", issueId: "SC-1145", masterId: "SC-1130" }, "admin")).toMatch(/already part of an incident/);
    expect(refused(s, { type: "link", issueId: "SC-1130", masterId: "SC-1130" }, "admin")).toMatch(/itself/);
    s = act(s, { type: "unlink", issueId: "SC-1145" }, "admin").state;
    expect(issue(s, "SC-1145").duplicateOf).toBe("");
    expect(demoTimeline(issue(s, "SC-1145"), s.data.now).some((e) => e.type === "linked")).toBe(false);
    s = act(s, { type: "groupIncident", masterId: "SC-1130", issueIds: ["SC-1145", "SC-1127"] }, "admin").state;
    expect(stats(s).incidents.find((c) => c.masterIssueId === "SC-1130")!.reportCount).toBe(3);
    expect(refused(s, { type: "groupIncident", masterId: "SC-1133", issueIds: ["SC-1145"] }, "admin")).toMatch(/already part of an incident/);
  });

  it("decides each claim exactly once and never overspends the budget", () => {
    let s = createDemoState(NOW);
    const pending = s.data.issues.find((i) => i.claim?.status === "pending")!;
    s = act(s, { type: "decideClaim", issueId: pending.id, decision: "approved" }, "admin").state;
    expect(refused(s, { type: "decideClaim", issueId: pending.id, decision: "approved" }, "admin")).toMatch(/already been processed/);
    expect(refused(s, { type: "decideClaim", issueId: pending.id, decision: "rejected" }, "admin")).toMatch(/already been processed/);
    expect(refused(s, { type: "decideClaim", issueId: "SC-1137", decision: "approved" }, "admin")).toMatch(/no expense claim/);

    // A claim larger than what is left is refused until funds are added.
    let t = createDemoState(NOW);
    t = act(t, { type: "start", issueId: "SC-1137" }, "worker").state;
    t = act(t, { type: "resolve", issueId: "SC-1137", summary: "Rewired the fitting." }, "worker").state;
    t = act(t, { type: "submitClaim", issueId: "SC-1137", amount: DEMO_BUDGET_TOTAL, description: "Rewiring" }, "worker").state;
    expect(refused(t, { type: "decideClaim", issueId: "SC-1137", decision: "approved" }, "admin")).toMatch(/Not enough budget/);
    t = act(t, { type: "addFunds", amount: "100000" }, "admin").state;
    expect(demoBudget(t)).toBe(DEMO_BUDGET_TOTAL + 100000);
    expect(stats(t).finance.budget).toBe(DEMO_BUDGET_TOTAL + 100000);
    expect(act(t, { type: "decideClaim", issueId: "SC-1137", decision: "approved" }, "admin").toast?.description).toMatch(/No real transaction/);
    for (const amount of [0, -5, "abc", 1e12]) expect(refused(t, { type: "addFunds", amount }, "admin")).toMatch(/amount|Amount/);
    expect(refused(t, { type: "submitClaim", issueId: "SC-1137", amount: 10, description: "again" }, "worker")).toMatch(/already has a claim/);
  });

  it("approves and removes workers; removing access changes no assignment", () => {
    let s = createDemoState(NOW);
    const team = s.workers.length;
    s = act(s, { type: "decideWorkerRequest", requestId: "r01", approve: true }, "admin").state;
    expect(s.workers).toHaveLength(team + 1);
    expect(s.workerRequests.map((r) => r.id)).toEqual(["r02"]);
    const newcomer = s.workers.at(-1)!;
    expect(isDemoId(newcomer.id)).toBe(true);
    expect(stats(s).workload.some((w) => w.worker.id === newcomer.id)).toBe(true);
    s = act(s, { type: "assign", issueId: "SC-1145", workerId: newcomer.id }, "admin").state;
    expect(demoWorkerName(s, newcomer.id)).toBe("Deepak Joshi");
    expect(refused(s, { type: "decideWorkerRequest", requestId: "r01", approve: true }, "admin")).toMatch(/already been handled/);
    s = act(s, { type: "decideWorkerRequest", requestId: "r02", approve: false }, "admin").state;
    expect(s.workers).toHaveLength(team + 1);

    s = act(s, { type: "removeWorker", workerId: "w03" }, "admin").state;
    expect(hasWorkerAccess(s, "w03")).toBe(false);
    expect(issue(s, "SC-1139").assignedTo).toBe("w03"); // stays assigned until reassigned, as in the real app
    expect(demoWorkerName(s, "w03")).toBe("Anil Verma");
    expect(refused(s, { type: "assign", issueId: "SC-1133", workerId: "w03" }, "admin")).toMatch(/worker access/);
    expect(refused(s, { type: "removeWorker", workerId: ME }, "admin")).toMatch(/Worker perspective/);
    expect(refused(s, { type: "assign", issueId: "SC-1133", workerId: "nobody" }, "admin")).toMatch(/worker access/);
  });

  it("adds and deletes locations, and QR ids resolve only to known ones", () => {
    let s = createDemoState(NOW);
    const added = act(s, { type: "addLocation", input: { name: "Staff room", buildingId: "blocks-3-4", floor: "1", room: "12" } }, "admin");
    s = added.state;
    expect(added.locationId).toBe("blocks-3-4-staff-room-12");
    const loc = resolveDemoLocation(s, added.locationId)!;
    expect(loc).toMatchObject({ custom: true, buildingId: "blocks-3-4", verificationStatus: "approximate" });
    expect(refused(s, { type: "addLocation", input: { name: "Staff room", buildingId: "blocks-3-4", floor: "", room: "12" } }, "admin")).toMatch(/already exists/);
    expect(refused(s, { type: "addLocation", input: { name: "   ", buildingId: "", floor: "", room: "" } }, "admin")).toMatch(/name/);
    expect(refused(s, { type: "addLocation", input: { name: "Lab", buildingId: "computer-science-block", floor: "", room: "" } }, "admin")).toMatch(/Choose a building/);
    // A place added without a map place is never given a position or a stronger status.
    const nowhere = act(s, { type: "addLocation", input: { name: "Notice board", buildingId: "", floor: "", room: "" } }, "admin").state;
    expect(resolveDemoLocation(nowhere, "notice-board")).toMatchObject({ buildingId: "", verificationStatus: "unverified" });

    // Reports made there land on its map place.
    const reported = act(s, { type: "createIssue", report: { ...report, locationId: loc.id } }, "student").state;
    expect(stats(reported).map.buildings.find((b) => b.buildingId === "blocks-3-4")!.open).toBe(stats(s).map.buildings.find((b) => b.buildingId === "blocks-3-4")!.open + 1);

    expect(refused(s, { type: "deleteLocation", locationId: "mjcet-block-1" }, "admin")).toMatch(/researched campus dataset/);
    s = act(s, { type: "deleteLocation", locationId: loc.id }, "admin").state;
    expect(resolveDemoLocation(s, loc.id)).toBeUndefined();
    expect(refused(s, { type: "createIssue", report: { ...report, locationId: loc.id } }, "student")).toMatch(/known campus location/);
    for (const bad of [null, undefined, 42, {}, "", "Block 4", "mjcet-block-4 ", "mjcet-block-4/../x", "%3Cscript%3E"]) expect(resolveDemoLocation(s, bad)).toBeUndefined();
    expect(resolveDemoLocation(s, "mjcet-seminar-hall")?.name).toBe("Seminar Hall, Block 4");
  });

  it("changes deadline targets and every deadline figure follows", () => {
    const s = createDemoState(NOW);
    expect(refused(s, { type: "saveSla", hours: { High: 48, Medium: 24, Low: 72 } }, "admin")).toBeTruthy();
    const strict = act(s, { type: "saveSla", hours: { High: 1, Medium: 2, Low: 3 } }, "admin").state;
    expect(strict.sla.isDefault).toBe(false);
    expect(stats(strict).sla.counts.missed).toBeGreaterThan(stats(s).sla.counts.missed);
  });
});

describe("students, discussion and notifications", () => {
  it("rates once, only their own resolved report", () => {
    let s = createDemoState(NOW);
    expect(refused(s, { type: "rate", issueId: "SC-1125", rating: 5, comment: "" }, "student")).toMatch(/Only the person who reported/);
    expect(refused(s, { type: "rate", issueId: "SC-1137", rating: 5, comment: "" }, "student")).toMatch(/once it has been resolved/);
    expect(refused(s, { type: "rate", issueId: "SC-1123", rating: 9, comment: "" }, "student")).toMatch(/1 to 5/);
    s = act(s, { type: "rate", issueId: "SC-1123", rating: 4, comment: "Good" }, "student").state;
    expect(refused(s, { type: "rate", issueId: "SC-1123", rating: 5, comment: "" }, "student")).toMatch(/already rated/);
  });

  it("upvotes toggle and never apply to a student's own report", () => {
    let s = createDemoState(NOW);
    const votes = issue(s, "SC-1139").upvotes;
    s = act(s, { type: "toggleUpvote", issueId: "SC-1139" }, "student").state;
    expect(issue(s, "SC-1139")).toMatchObject({ upvotes: votes + 1, upvotedByMe: true });
    s = act(s, { type: "toggleUpvote", issueId: "SC-1139" }, "student").state;
    expect(issue(s, "SC-1139")).toMatchObject({ upvotes: votes, upvotedByMe: false });
    expect(refused(s, { type: "toggleUpvote", issueId: "SC-1137" }, "student")).toMatch(/your own report/);
  });

  it("keeps the discussion private to the reporter and staff", () => {
    let s = createDemoState(NOW);
    expect(s.messages["SC-1140"].length).toBeGreaterThan(0);
    expect(refused(s, { type: "postMessage", issueId: "SC-1139", text: "Any update?" }, "student")).toMatch(/private/);
    expect(refused(s, { type: "postMessage", issueId: "SC-1140", text: "   " }, "student")).toMatch(/empty/);
    expect(refused(s, { type: "postMessage", issueId: "SC-1140", text: "x".repeat(2001) }, "student")).toMatch(/2000/);
    const count = s.messages["SC-1140"].length;
    s = act(s, { type: "postMessage", issueId: "SC-1140", text: "It tripped again at noon." }, "student").state;
    expect(s.messages["SC-1140"]).toHaveLength(count + 1);
    expect(s.messages["SC-1140"].at(-1)).toMatchObject({ authorRole: "student", text: "It tripped again at noon." });
    expect(s.notifications.worker[0].title).toBe("New message"); // SC-1140 is the Worker persona's task
    expect(s.notifications.admin[0].title).toBe("New message");
    s = act(s, { type: "postMessage", issueId: "SC-1139", text: "Plumber booked for tomorrow." }, "admin").state;
    expect(s.notifications.student[0].title).not.toBe("New message"); // not the Student persona's report
  });

  it("marks notifications read and unread per perspective", () => {
    let s = createDemoState(NOW);
    const first = s.notifications.admin.find((n) => !n.read)!;
    s = act(s, { type: "markRead", notificationId: first.id, read: true }, "admin").state;
    expect(s.notifications.admin.find((n) => n.id === first.id)!.read).toBe(true);
    expect(s.changes).toBe(0); // reading a notification is not a change worth a reset warning
    s = act(s, { type: "markRead", notificationId: first.id, read: false }, "admin").state;
    expect(s.notifications.admin.find((n) => n.id === first.id)!.read).toBe(false);
    expect(refused(s, { type: "markRead", notificationId: first.id, read: true }, "student")).toMatch(/isn't in this inbox/);
    s = act(s, { type: "markAllRead" }, "admin").state;
    expect(s.notifications.admin.every((n) => n.read)).toBe(true);
    expect(s.notifications.worker.some((n) => !n.read)).toBe(true);
  });
});
