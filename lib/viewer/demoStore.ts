// ============================================
// Explore Mode demo engine
// ============================================
// The whole of Explore Mode's "database": one immutable state value and one
// pure function that applies an action to it. It is the Explore counterpart
// of the signed-in data layer (lib/firestore.ts, lib/finance.ts, …) and
// follows the same rules: the same input validation (lib/validation.ts,
// lib/sharedRules.ts), the same lifecycle (lib/constants.ts) and the same
// role restrictions the Firestore rules enforce for real accounts.
//
// Nothing here imports Firebase, reads the network or touches browser
// storage. State lives in memory for one visit: a reload, or "Reset demo",
// returns to the deterministic baseline built by createDemoState().
//
// An action that is not allowed returns { ok: false, error } and leaves the
// state untouched. It never reports success for something it did not do.

import { Priority, SlaConfig } from "@/types";
import { LIMITS, canTransition } from "@/lib/constants";
import { DEFAULT_SLA_CONFIG, validateSlaHours } from "@/lib/intelligence/sla";
import { getBuilding } from "@/lib/campus";
import { ValidationError } from "@/lib/errors";
import { parseAmount, validateChatMessage, validateClaimDescription, cleanText } from "@/lib/validation";
import { NewLocationInput, isLocationIdShape, validateFeedbackInput, validateLocationInput } from "@/lib/sharedRules";
import { analyzeIssueDetails } from "@/services/aiService";
import {
  DEMO_BUDGET_TOTAL,
  DEMO_LOCATIONS,
  DEMO_PERSONA,
  DEMO_STUDENTS,
  DEMO_WORKERS,
  DEMO_WORKER_REQUESTS,
  DemoData,
  DemoIssue,
  DemoLocation,
  DemoRole,
  DemoWorker,
  buildDemoData,
} from "./demoData";
import { DemoNotification, seedNotifications } from "./demoFeed";

const HOUR = 3_600_000;

export interface DemoMessage {
  id: string;
  authorRole: DemoRole;
  authorName: string;
  text: string;
  at: Date;
}

export interface DemoWorkerRequest {
  id: string;
  name: string;
  team: string;
  requestedHoursAgo: number;
}

export interface DemoState {
  data: DemoData;
  sla: SlaConfig;
  notifications: Record<DemoRole, DemoNotification[]>;
  workerRequests: DemoWorkerRequest[];
  /** People who currently have worker access. */
  workers: DemoWorker[];
  /** Researched campus locations plus any the demo administrator added. */
  locations: DemoLocation[];
  /** Funds added to the sample budget during this visit. */
  budgetAdded: number;
  /** Discussion per issue id. */
  messages: Record<string, DemoMessage[]>;
  /** Next number for ids created during this visit. */
  seq: number;
  /** Simulated changes made since the baseline (0 = untouched). */
  changes: number;
}

export interface NewDemoReport {
  title: string;
  description: string;
  locationId: string;
  category?: string;
  priority?: Priority;
  withPhoto: boolean;
}

export type DemoAction =
  | { type: "createIssue"; report: NewDemoReport }
  | { type: "assign"; issueId: string; workerId: string }
  | { type: "unassign"; issueId: string }
  | { type: "setEscalation"; issueId: string; escalated: boolean }
  | { type: "start"; issueId: string }
  | { type: "resolve"; issueId: string; summary: string }
  | { type: "submitClaim"; issueId: string; amount: number | string; description: string }
  | { type: "decideClaim"; issueId: string; decision: "approved" | "rejected" }
  | { type: "rate"; issueId: string; rating: number; comment: string }
  | { type: "toggleUpvote"; issueId: string }
  | { type: "link"; issueId: string; masterId: string }
  | { type: "unlink"; issueId: string }
  | { type: "groupIncident"; masterId: string; issueIds: string[] }
  | { type: "postMessage"; issueId: string; text: string }
  | { type: "saveSla"; hours: SlaConfig["hours"] }
  | { type: "decideWorkerRequest"; requestId: string; approve: boolean }
  | { type: "removeWorker"; workerId: string }
  | { type: "addFunds"; amount: number | string }
  | { type: "addLocation"; input: NewLocationInput }
  | { type: "deleteLocation"; locationId: string }
  | { type: "markRead"; notificationId: string; read: boolean }
  | { type: "markAllRead" };

export interface DemoToast {
  title: string;
  description?: string;
}

export type DemoResult =
  | { ok: true; state: DemoState; toast?: DemoToast; issueId?: string; locationId?: string }
  | { ok: false; state: DemoState; error: string };

export const DEMO_NOTE = "Demo mode — no real data was modified.";

// ---------- Baseline ----------

function seedMessages(data: DemoData): Record<string, DemoMessage[]> {
  const out: Record<string, DemoMessage[]> = {};
  const say = (issueId: string, minutesAfter: number, authorRole: DemoRole, authorName: string, text: string) => {
    const issue = data.issues.find((i) => i.id === issueId);
    if (!issue) return;
    const at = new Date(Math.min(data.now.getTime() - 60_000, issue.createdAt.getTime() + minutesAfter * 60_000));
    (out[issueId] ??= []).push({ id: `demo-m-seed-${issueId}-${out[issueId]?.length ?? 0}`, authorRole, authorName, text, at });
  };
  say("SC-1140", 20, "student", DEMO_PERSONA.student.name, "It trips again a few minutes after it is reset.");
  say("SC-1140", 55, "worker", DEMO_PERSONA.worker.name, "Thanks. I'll check the breaker and the wiring on that circuit this afternoon.");
  say("SC-1136", 90, "admin", DEMO_PERSONA.admin.name, "There is an event here tomorrow morning. Please finish today if you can.");
  say("SC-1136", 130, "worker", DEMO_PERSONA.worker.name, "Understood. The replacement part is on its way.");
  return out;
}

/** The deterministic starting point of every Explore visit. */
export function createDemoState(now: Date): DemoState {
  const data = buildDemoData(now);
  return {
    data,
    sla: DEFAULT_SLA_CONFIG,
    notifications: { student: seedNotifications(data, "student"), worker: seedNotifications(data, "worker"), admin: seedNotifications(data, "admin") },
    workerRequests: DEMO_WORKER_REQUESTS.map((r) => ({ ...r })),
    workers: DEMO_WORKERS.map((w) => ({ ...w })),
    locations: DEMO_LOCATIONS.map((l) => ({ ...l })),
    budgetAdded: 0,
    messages: seedMessages(data),
    seq: 0,
    changes: 0,
  };
}

// ---------- Lookups ----------

export function demoWorkerName(state: Pick<DemoState, "workers">, id: string): string {
  if (!id) return "Unassigned";
  return state.workers.find((w) => w.id === id)?.name ?? DEMO_WORKERS.find((w) => w.id === id)?.name ?? "A former worker";
}

/** Whether an id still has worker access (someone removed keeps their name on old work). */
export function hasWorkerAccess(state: Pick<DemoState, "workers">, id: string): boolean {
  return state.workers.some((w) => w.id === id);
}

export function demoBudget(state: Pick<DemoState, "budgetAdded">): number {
  return DEMO_BUDGET_TOTAL + state.budgetAdded;
}

/**
 * A location from an untrusted id (a QR link). Only an id of the right shape
 * that names a known, current location resolves; everything else is refused.
 */
export function resolveDemoLocation(state: Pick<DemoState, "locations">, id: unknown): DemoLocation | undefined {
  if (!isLocationIdShape(id)) return undefined;
  return state.locations.find((l) => l.id === id);
}

function spent(issues: DemoIssue[]): number {
  return issues.reduce((sum, i) => sum + (i.claim?.status === "approved" ? i.claim.amount : 0), 0);
}

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

// ---------- Reducer ----------

class Refused extends Error {}
const refuse = (message: string): never => {
  throw new Refused(message);
};

const ROLE_NAMES: Record<DemoRole, string> = { student: "the Student", worker: "the Worker", admin: "the Admin" };

function only(role: DemoRole, ...allowed: DemoRole[]) {
  if (!allowed.includes(role)) refuse(`Switch to ${allowed.map((r) => ROLE_NAMES[r]).join(" or ")} perspective to do this.`);
}

/**
 * Apply one simulated action as `role`. Pure: the same state, action, role
 * and time always give the same result.
 */
export function applyDemoAction(state: DemoState, action: DemoAction, role: DemoRole, at: Date = new Date()): DemoResult {
  try {
    return run(state, action, role, at);
  } catch (err) {
    if (err instanceof Refused || err instanceof ValidationError) return { ok: false, state, error: err.message };
    throw err;
  }
}

function run(state: DemoState, action: DemoAction, role: DemoRole, at: Date): DemoResult {
  const me = DEMO_PERSONA.worker.id;
  let seq = state.seq;
  let notifications = state.notifications;
  // The demo clock never runs backwards, so a simulated step is always "now" for deadlines and timelines.
  const now = at.getTime() > state.data.now.getTime() ? at : state.data.now;

  const issue = (id: string): DemoIssue => state.data.issues.find((i) => i.id === id) ?? refuse("That issue isn't in the demo.");
  const notify = (roles: DemoRole[], n: Omit<DemoNotification, "id" | "at" | "read">) => {
    const next = { ...notifications };
    for (const r of roles) next[r] = [{ ...n, id: `demo-n-${seq++}`, at: now, read: false }, ...next[r]];
    notifications = next;
  };
  const done = (patch: Partial<DemoState>, toast?: DemoToast, extra: { issueId?: string; locationId?: string } = {}): DemoResult => ({
    ok: true,
    state: { ...state, data: { ...state.data, now }, ...patch, notifications, seq, changes: state.changes + 1 },
    toast,
    ...extra,
  });
  const withIssues = (issues: DemoIssue[]) => ({ data: { now, issues } });
  const patchIssue = (id: string, change: (i: DemoIssue) => DemoIssue) => withIssues(state.data.issues.map((i) => (i.id === id ? change(i) : i)));

  switch (action.type) {
    case "createIssue": {
      const title = cleanText(action.report.title);
      const description = cleanText(action.report.description, true);
      if (title.length < 5) refuse("Give the problem a short title (at least 5 characters).");
      if (title.length > LIMITS.title) refuse(`Keep the title to ${LIMITS.title} characters or fewer.`);
      if (description.length < 10) refuse("Describe what is wrong (at least 10 characters).");
      if (description.length > LIMITS.description) refuse(`Keep the description to ${LIMITS.description} characters or fewer.`);
      const place = resolveDemoLocation(state, action.report.locationId) ?? refuse("Choose a known campus location.");
      const analysis = analyzeIssueDetails({ title, description, location: place.name });
      const id = `SC-${1146 + state.data.issues.filter((i) => i.simulated).length}`;
      const created: DemoIssue = {
        id,
        title,
        description,
        category: action.report.category ?? analysis.category,
        priority: action.report.priority ?? analysis.priority,
        status: "Open",
        location: place.name,
        locationId: place.id,
        assignedTo: "",
        duplicateOf: "",
        createdAt: now,
        escalated: false,
        reporterId: DEMO_PERSONA.student.id,
        reporterName: DEMO_PERSONA.student.name,
        mine: true,
        upvotes: 0,
        hasPhoto: action.report.withPhoto,
        aiConfidence: analysis.confidence,
        aiDepartment: analysis.department,
        resolutionSummary: "",
        simulated: true,
      };
      notify(["student"], { kind: "report", title: "Report received", body: `"${title}" was added as ${id}. (Demo)`, issueId: id });
      notify(["admin"], { kind: "report", title: `New ${created.priority.toLowerCase()}-priority report`, body: `"${title}" at ${place.name}.`, issueId: id });
      return done(withIssues([created, ...state.data.issues]), { title: "Demo report submitted", description: `${id} was added to this demo only. ${DEMO_NOTE}` }, { issueId: id });
    }

    case "assign": {
      const target = issue(action.issueId);
      if (target.status === "Resolved") refuse("Resolved issues can't be reassigned.");
      if (!state.workers.some((w) => w.id === action.workerId)) refuse("Choose someone who has worker access.");
      if (role === "worker") {
        // A worker may only take an unassigned open issue for themselves (the open pool).
        if (action.workerId !== me) refuse("A worker can only take a task for themselves.");
        if (target.assignedTo || target.status !== "Open") refuse(`This task belongs to ${demoWorkerName(state, target.assignedTo)}.`);
      } else only(role, "admin");
      if (target.assignedTo === action.workerId) refuse(`${demoWorkerName(state, action.workerId)} already has this issue.`);
      const name = demoWorkerName(state, action.workerId);
      notify(["worker"], { kind: "assigned", title: action.workerId === me ? "New task assigned to you" : "Task assigned", body: `"${target.title}" was assigned to ${name}. (Demo)`, issueId: target.id });
      return done(
        patchIssue(target.id, (i) => ({ ...i, assignedTo: action.workerId, assignedAt: now })),
        { title: role === "worker" ? "Task taken (demo)" : "Demo assignment", description: `${name} now has ${target.id}. ${DEMO_NOTE}` }
      );
    }

    case "unassign": {
      only(role, "admin");
      const target = issue(action.issueId);
      if (target.status === "Resolved") refuse("Resolved issues can't be reassigned.");
      if (!target.assignedTo) refuse("This issue isn't assigned to anyone.");
      const name = demoWorkerName(state, target.assignedTo);
      notify(["worker"], { kind: "assigned", title: "Task unassigned", body: `"${target.title}" is no longer assigned to ${name}. (Demo)`, issueId: target.id });
      return done(
        patchIssue(target.id, (i) => ({ ...i, assignedTo: "", assignedAt: undefined })),
        { title: "Issue unassigned (demo)", description: `${target.status === "Open" ? "It is back in the open pool." : "It needs a new assignee."} ${DEMO_NOTE}` }
      );
    }

    case "setEscalation": {
      only(role, "admin");
      const target = issue(action.issueId);
      if (target.status === "Resolved") refuse("Resolved issues can't be escalated.");
      if (!!target.escalated === action.escalated) refuse(action.escalated ? "This issue is already escalated." : "This issue isn't escalated.");
      if (action.escalated && target.assignedTo) notify(["worker"], { kind: "deadline", title: "Issue escalated", body: `"${target.title}" was escalated by an administrator.`, issueId: target.id });
      return done(
        patchIssue(target.id, (i) => ({ ...i, escalated: action.escalated })),
        { title: action.escalated ? "Issue escalated (demo)" : "Escalation cleared (demo)", description: action.escalated ? `It now appears first in the assigned worker's list. ${DEMO_NOTE}` : DEMO_NOTE }
      );
    }

    case "start": {
      only(role, "worker");
      const target = issue(action.issueId);
      if (!canTransition(target.status, "In Progress")) refuse("Only an open issue can be started.");
      if (target.assignedTo && target.assignedTo !== me) refuse(`This task belongs to ${demoWorkerName(state, target.assignedTo)}.`);
      notify(["student"], { kind: "status", title: "Work has started", body: `"${target.title}" is now in progress.`, issueId: target.id });
      return done(
        patchIssue(target.id, (i) => ({ ...i, status: "In Progress", startedAt: now, assignedTo: me, assignedAt: i.assignedTo ? i.assignedAt : now })),
        { title: "Work started", description: `${target.id} is now in progress. ${DEMO_NOTE}` }
      );
    }

    case "resolve": {
      only(role, "worker");
      const target = issue(action.issueId);
      if (!canTransition(target.status, "Resolved")) refuse("Only an issue that is in progress can be resolved.");
      if (target.assignedTo !== me) refuse(`This task belongs to ${demoWorkerName(state, target.assignedTo)}.`);
      const summary = cleanText(action.summary, true);
      if (summary.length < 5) refuse("Say what was done (at least 5 characters).");
      notify(["student"], { kind: "status", title: "Your issue was resolved", body: `"${target.title}" has been marked resolved. How was the fix?`, issueId: target.id });
      return done(
        patchIssue(target.id, (i) => ({ ...i, status: "Resolved", resolvedAt: now, resolutionSummary: summary, escalated: false })),
        { title: "Demo resolution", description: `${target.id} was marked resolved. ${DEMO_NOTE}` }
      );
    }

    case "submitClaim": {
      only(role, "worker");
      const target = issue(action.issueId);
      if (target.status !== "Resolved") refuse("A claim can be submitted once the issue is resolved.");
      if (target.assignedTo !== me) refuse("Only the worker who resolved the issue can claim for it.");
      if (target.claim && target.claim.status !== "rejected") refuse("This issue already has a claim.");
      const amount = parseAmount(action.amount, LIMITS.maxClaimAmount);
      const description = validateClaimDescription(action.description);
      notify(["admin"], { kind: "claim", title: "Expense claim to review", body: `${rupees(amount)} for "${target.title}".`, issueId: target.id });
      return done(
        patchIssue(target.id, (i) => ({ ...i, claim: { amount, description, status: "pending" } })),
        { title: "Demo claim submitted", description: `${rupees(amount)} is waiting for an administrator. ${DEMO_NOTE}` }
      );
    }

    case "decideClaim": {
      only(role, "admin");
      const target = issue(action.issueId);
      const claim = target.claim ?? refuse("This issue has no expense claim.");
      // A claim is decided exactly once, as in the real ledger.
      if (claim.status !== "pending") refuse("This claim has already been processed.");
      if (action.decision === "approved" && claim.amount > demoBudget(state) - spent(state.data.issues)) refuse("Not enough budget remaining to pay this claim. Add funds first.");
      notify(["worker"], {
        kind: "claim",
        title: action.decision === "approved" ? "Expense claim paid" : "Expense claim rejected",
        body: action.decision === "approved" ? `${rupees(claim.amount)} for "${target.title}" was paid. (Demo)` : `The claim for "${target.title}" was not approved.`,
        issueId: target.id,
      });
      return done(
        patchIssue(target.id, (i) => ({ ...i, claim: { ...claim, status: action.decision, decidedAt: now } })),
        action.decision === "approved" ? { title: "Demo payment", description: `No real transaction was created. ${DEMO_NOTE}` } : { title: "Claim rejected (demo)", description: DEMO_NOTE }
      );
    }

    case "rate": {
      only(role, "student");
      const target = issue(action.issueId);
      if (!target.mine) refuse("Only the person who reported this issue can rate it.");
      if (target.status !== "Resolved") refuse("You can rate an issue once it has been resolved.");
      if (target.feedback) refuse("You have already rated this fix.");
      const input = validateFeedbackInput(action.rating, action.comment);
      return done(
        patchIssue(target.id, (i) => ({ ...i, feedback: { ...input, at: now } })),
        { title: "Thanks for the feedback", description: `Rated ${input.rating}/5 in the demo. ${DEMO_NOTE}` }
      );
    }

    case "toggleUpvote": {
      only(role, "student");
      const target = issue(action.issueId);
      if (target.mine) refuse("You can't upvote your own report.");
      if (target.status === "Resolved") refuse("Resolved issues can't be upvoted.");
      const on = !target.upvotedByMe;
      return done(
        patchIssue(target.id, (i) => ({ ...i, upvotedByMe: on, upvotes: Math.max(0, i.upvotes + (on ? 1 : -1)) })),
        { title: on ? "Upvoted (demo)" : "Upvote removed (demo)", description: DEMO_NOTE }
      );
    }

    case "link": {
      only(role, "admin");
      const target = issue(action.issueId);
      const other = issue(action.masterId);
      const masterId = other.duplicateOf || other.id;
      if (masterId === target.id) refuse("A report can't be linked to itself.");
      if (target.duplicateOf) refuse("This report is already part of an incident. Remove it from that incident first.");
      if (state.data.issues.some((i) => i.duplicateOf === target.id)) refuse("This report already has linked reports; link those to the other incident instead.");
      if (target.mine) notify(["student"], { kind: "report", title: "Linked to an existing report", body: `"${target.title}" was linked to ${masterId}, so both are fixed together.`, issueId: target.id });
      return done(
        patchIssue(target.id, (i) => ({ ...i, duplicateOf: masterId, events: [...(i.events ?? []), { type: "linked", at: now, text: `Linked to ${masterId} as the same problem` }] })),
        { title: "Report linked to the incident (demo)", description: DEMO_NOTE }
      );
    }

    case "unlink": {
      only(role, "admin");
      const target = issue(action.issueId);
      if (!target.duplicateOf) refuse("This report isn't part of an incident.");
      return done(
        patchIssue(target.id, (i) => ({ ...i, duplicateOf: "", events: (i.events ?? []).filter((e) => e.type !== "linked") })),
        { title: "Report removed from the incident (demo)", description: DEMO_NOTE }
      );
    }

    case "groupIncident": {
      only(role, "admin");
      const master = issue(action.masterId);
      if (master.duplicateOf) refuse("The main report is already part of another incident.");
      const ids = action.issueIds.filter((id) => id !== master.id);
      if (ids.length === 0) refuse("There is nothing to group.");
      for (const id of ids) {
        const member = issue(id);
        if (member.duplicateOf) refuse(`${id} is already part of an incident.`);
        if (state.data.issues.some((i) => i.duplicateOf === id)) refuse(`${id} already has linked reports.`);
      }
      const set = new Set(ids);
      return done(
        withIssues(state.data.issues.map((i) => (set.has(i.id) ? { ...i, duplicateOf: master.id, events: [...(i.events ?? []), { type: "linked" as const, at: now, text: `Linked to ${master.id} as the same problem` }] } : i))),
        { title: "Reports grouped into one incident (demo)", description: `${ids.length} report${ids.length === 1 ? "" : "s"} linked to ${master.id}. ${DEMO_NOTE}` }
      );
    }

    case "postMessage": {
      const target = issue(action.issueId);
      // The discussion is private to the reporter and campus staff.
      if (role === "student" && !target.mine) refuse("The discussion is private to the person who reported this issue and campus staff.");
      const text = validateChatMessage(action.text);
      const authorName = role === "student" ? DEMO_PERSONA.student.name : role === "worker" ? DEMO_PERSONA.worker.name : DEMO_PERSONA.admin.name;
      const message: DemoMessage = { id: `demo-m-${seq++}`, authorRole: role, authorName, text, at: now };
      const others = (["student", "worker", "admin"] as DemoRole[]).filter((r) => r !== role && (r !== "student" || target.mine) && (r !== "worker" || target.assignedTo === me));
      notify(others, { kind: "report", title: "New message", body: `${authorName} wrote on "${target.title}".`, issueId: target.id });
      return done({ messages: { ...state.messages, [target.id]: [...(state.messages[target.id] ?? []), message] } }, { title: "Message sent (demo)", description: DEMO_NOTE });
    }

    case "saveSla": {
      only(role, "admin");
      const problem = validateSlaHours(action.hours);
      if (problem) refuse(problem);
      return done({ sla: { hours: { ...action.hours }, isDefault: false } }, { title: "Deadline targets updated", description: `Every deadline and compliance figure was recalculated for this demo. ${DEMO_NOTE}` });
    }

    case "decideWorkerRequest": {
      only(role, "admin");
      const request = state.workerRequests.find((r) => r.id === action.requestId) ?? refuse("That request has already been handled.");
      const workerRequests = state.workerRequests.filter((r) => r.id !== request.id);
      if (!action.approve) return done({ workerRequests }, { title: "Request declined (demo)", description: DEMO_NOTE });
      const reference = DEMO_WORKERS.find((w) => w.team === request.team);
      const worker: DemoWorker = { id: `demo-w-${seq++}`, name: request.name, team: request.team, skills: reference?.skills.slice(0, 1) ?? ["General"], shift: "Day" };
      return done({ workerRequests, workers: [...state.workers, worker] }, { title: `${request.name} is now a worker (demo)`, description: `They can be assigned ${worker.skills[0]} work. ${DEMO_NOTE}` });
    }

    case "removeWorker": {
      only(role, "admin");
      const worker = state.workers.find((w) => w.id === action.workerId) ?? refuse("That person doesn't have worker access.");
      if (worker.id === me) refuse("The Worker perspective uses this account, so it stays in the demo. Remove another worker.");
      // As in the real app, issues already assigned to them stay assigned until an administrator reassigns them.
      const left = state.data.issues.filter((i) => i.assignedTo === worker.id && i.status !== "Resolved").length;
      return done(
        { workers: state.workers.filter((w) => w.id !== worker.id) },
        { title: `Worker access removed from ${worker.name} (demo)`, description: `${left ? `${left} unfinished task${left === 1 ? " is" : "s are"} still assigned to them; reassign ${left === 1 ? "it" : "them"}. ` : ""}${DEMO_NOTE}` }
      );
    }

    case "addFunds": {
      only(role, "admin");
      const amount = parseAmount(action.amount, LIMITS.maxFundsAmount);
      return done({ budgetAdded: Math.round((state.budgetAdded + amount) * 100) / 100 }, { title: `${rupees(amount)} added to the budget (demo)`, description: `No real money moved. ${DEMO_NOTE}` });
    }

    case "addLocation": {
      only(role, "admin");
      const input = validateLocationInput(action.input);
      if (state.locations.some((l) => l.id === input.id)) refuse("A location with this name already exists.");
      const place = getBuilding(input.buildingId);
      const location: DemoLocation = {
        id: input.id,
        name: input.name,
        buildingId: input.buildingId,
        floor: input.floor,
        room: input.room,
        spot: input.name,
        zones: [],
        // A location someone types in is their own description: it inherits nothing stronger than its map place.
        verificationStatus: place ? place.verificationStatus : "unverified",
        institutionId: place?.institutionId ?? null,
        custom: true,
      };
      return done({ locations: [...state.locations, location] }, { title: "Location added (demo)", description: `Its QR code opens the demo report form. ${DEMO_NOTE}` }, { locationId: location.id });
    }

    case "deleteLocation": {
      only(role, "admin");
      const location = state.locations.find((l) => l.id === action.locationId) ?? refuse("That location isn't in the demo.");
      if (!location.custom) refuse("This location is part of the researched campus dataset and can't be deleted here.");
      return done({ locations: state.locations.filter((l) => l.id !== location.id) }, { title: "Location deleted (demo)", description: `Reports already made there keep their text. ${DEMO_NOTE}` });
    }

    case "markRead": {
      const list = state.notifications[role];
      if (!list.some((n) => n.id === action.notificationId)) refuse("That notification isn't in this inbox.");
      return { ok: true, state: { ...state, notifications: { ...state.notifications, [role]: list.map((n) => (n.id === action.notificationId ? { ...n, read: action.read } : n)) } } };
    }

    case "markAllRead": {
      return {
        ok: true,
        state: { ...state, notifications: { ...state.notifications, [role]: state.notifications[role].map((n) => ({ ...n, read: true })) } },
        toast: { title: "Notifications marked as read", description: DEMO_NOTE },
      };
    }
  }
}

/** Who a discussion message is from, as the reader sees it. */
export function messageAuthorLabel(message: DemoMessage, reader: DemoRole): string {
  if (message.authorRole === reader) return "You";
  return message.authorName;
}

/** Fictional reporters by id (used when a view needs a name the issue doesn't carry). */
export function demoStudentName(id: string): string {
  return DEMO_STUDENTS.find((s) => s.id === id)?.name ?? "A student";
}

export { HOUR as DEMO_HOUR };
