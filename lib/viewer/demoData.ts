// ============================================
// Viewer Mode sample dataset
// ============================================
// A fixed, synthetic dataset for the public Viewer. It never comes from or
// goes to Firestore: no real people, emails, phone numbers, account ids,
// photos, receipts or comments. Buildings are the schematic campus layout in
// lib/campus.ts. Times are offsets from the moment the page opens, so SLA
// states (on track / due soon / overdue) stay meaningful whenever it's viewed.
// Keep every `ago` under 312 h so all issues fall inside the 14-day trend.
// Every number shown in Viewer Mode is computed from this file.

import { IssueEventType, IssueStatus, IssueSummary, Priority } from "@/types";

const HOUR = 3_600_000;

export type DemoTechnicianId = "tech-a" | "tech-b" | "tech-c";

export interface DemoTechnician {
  id: DemoTechnicianId;
  /** Anonymous label — sample staff, not real employees. */
  label: string;
  speciality: string;
}

export const DEMO_TECHNICIANS: DemoTechnician[] = [
  { id: "tech-a", label: "Technician A", speciality: "Electrical and building works" },
  { id: "tech-b", label: "Technician B", speciality: "Plumbing, safety and grounds" },
  { id: "tech-c", label: "Technician C", speciality: "IT and furniture" },
];

export interface DemoClaim {
  amount: number;
  description: string;
  status: "pending" | "approved" | "rejected";
}

export interface DemoFeedback {
  rating: number;
  comment: string;
}

export interface DemoIssue extends IssueSummary {
  description: string;
  /** Reported by the sample student account shown in the Student view. */
  mine: boolean;
  resolutionSummary: string;
  feedback?: DemoFeedback;
  claim?: DemoClaim;
}

export interface DemoEvent {
  type: IssueEventType;
  at: Date;
  text: string;
}

/** The sample budget used by the Admin finance overview. */
export const DEMO_BUDGET_TOTAL = 200_000;

/** The perspective shown in the Worker view. */
export const DEMO_WORKER_ID: DemoTechnicianId = "tech-a";

interface Spec {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  location: string;
  status: IssueStatus;
  /** Hours before "now" the issue was reported. */
  ago: number;
  /** Hours after reporting that work started / it was resolved. */
  start?: number;
  resolve?: number;
  assignee?: DemoTechnicianId;
  mine?: boolean;
  duplicateOf?: string;
  escalated?: boolean;
  resolution?: string;
  feedback?: DemoFeedback;
  claim?: DemoClaim;
}

const SPECS: Spec[] = [
  // ---- open and in progress ----
  { id: "v01", title: "Classroom projector not turning on", description: "The projector in Room 104 shows no power light. Lectures are using the whiteboard only.", category: "Electrical", priority: "High", location: "Block A, Room 104", status: "In Progress", ago: 5, start: 1, assignee: "tech-a", mine: true },
  { id: "v02", title: "Projector flickering in Room 104", description: "The image keeps flickering and switching off during class.", category: "Electrical", priority: "Medium", location: "Block A, Room 104", status: "Open", ago: 3, duplicateOf: "v01" },
  { id: "v03", title: "Water leaking near ground-floor washroom", description: "Water is pooling in the corridor outside the washroom. The floor is slippery.", category: "Plumbing", priority: "High", location: "Block B, ground-floor washroom", status: "Open", ago: 9, assignee: "tech-b", escalated: true },
  { id: "v04", title: "AC not cooling in seminar hall", description: "The air conditioning runs but the hall stays warm during afternoon sessions.", category: "Electrical", priority: "Medium", location: "Auditorium, seminar hall", status: "In Progress", ago: 20, start: 6, assignee: "tech-a" },
  { id: "v05", title: "Corridor light damaged on second floor", description: "One corridor light is hanging loose and does not switch on.", category: "Electrical", priority: "Low", location: "Block C, second-floor corridor", status: "Open", ago: 10, mine: true },
  { id: "v06", title: "Wi-Fi drops in Lab 3", description: "The wireless connection drops every few minutes, interrupting lab work.", category: "IT", priority: "High", location: "Laboratory Complex, Lab 3", status: "Open", ago: 2, assignee: "tech-c" },
  { id: "v07", title: "Wi-Fi not connecting in Lab 3", description: "Laptops can't connect to the lab network this morning.", category: "IT", priority: "Medium", location: "Laboratory Complex, Lab 3", status: "Open", ago: 1, duplicateOf: "v06", mine: true },
  { id: "v08", title: "Broken chair in reading room", description: "A reading-room chair has a cracked leg and wobbles.", category: "Furniture", priority: "Low", location: "Central Library, reading room", status: "In Progress", ago: 60, start: 30, assignee: "tech-c" },
  { id: "v09", title: "Overflowing bins near canteen", description: "The outdoor bins are full and litter is spreading to the seating area.", category: "Cleanliness", priority: "Medium", location: "Canteen, outdoor seating", status: "Open", ago: 30 },
  { id: "v10", title: "Sprinkler broken on sports ground", description: "A sprinkler head is broken and leaves a dry patch on the field.", category: "Landscaping", priority: "Low", location: "Sports Complex, main ground", status: "Open", ago: 100, assignee: "tech-b" },
  { id: "v11", title: "Exit sign not lit in auditorium", description: "The emergency exit sign at the rear door is not illuminated.", category: "Safety", priority: "Medium", location: "Auditorium, rear exit", status: "Open", ago: 4 },
  // ---- resolved ----
  { id: "v12", title: "Leaking tap in hostel washroom", description: "A washroom tap keeps dripping after it is closed.", category: "Plumbing", priority: "Medium", location: "Hostel Block 2, first floor", status: "Resolved", ago: 70, start: 4, resolve: 18, assignee: "tech-b", mine: true, resolution: "Replaced the worn tap cartridge and checked for leaks.", feedback: { rating: 5, comment: "Fixed the same day." }, claim: { amount: 450, description: "Replacement tap cartridge", status: "approved" } },
  { id: "v13", title: "Smart board not responding", description: "The smart board doesn't react to touch.", category: "IT", priority: "Medium", location: "Block D, Room 210", status: "Resolved", ago: 120, start: 10, resolve: 30, assignee: "tech-c", resolution: "Recalibrated the touch panel and updated the driver.", feedback: { rating: 3, comment: "Works now, but it took a while." } },
  { id: "v14", title: "Loose handrail on hostel stairs", description: "The handrail on the main staircase moves when you hold it.", category: "Safety", priority: "High", location: "Hostel Block 1, main staircase", status: "Resolved", ago: 50, start: 1, resolve: 5, assignee: "tech-a", resolution: "Re-fixed the handrail with new wall brackets.", feedback: { rating: 5, comment: "Quick and safe repair." }, claim: { amount: 1200, description: "Wall brackets and fixings", status: "pending" } },
  { id: "v15", title: "Flickering tube light in Block E", description: "A tube light flickers constantly in Room 12.", category: "Electrical", priority: "Low", location: "Block E, Room 12", status: "Resolved", ago: 200, start: 20, resolve: 40, assignee: "tech-a", resolution: "Replaced the tube with an LED fitting.", feedback: { rating: 4, comment: "Good." }, claim: { amount: 320, description: "LED tube light", status: "approved" } },
  { id: "v16", title: "Blocked drain in canteen kitchen", description: "The kitchen floor drain is blocked and water is backing up.", category: "Plumbing", priority: "High", location: "Canteen, kitchen", status: "Resolved", ago: 150, start: 2, resolve: 9, assignee: "tech-b", resolution: "Cleared the drain line and flushed the trap.", feedback: { rating: 2, comment: "The smell returned the next day." }, claim: { amount: 900, description: "Drain cleaning tools", status: "approved" } },
  { id: "v17", title: "Printer jam in library", description: "The help-desk printer jams on every job.", category: "IT", priority: "Low", location: "Central Library, help desk", status: "Resolved", ago: 90, start: 12, resolve: 20, assignee: "tech-c", resolution: "Removed a torn sheet and replaced the pickup roller.", feedback: { rating: 4, comment: "" } },
  { id: "v18", title: "Broken window latch in Block B", description: "The window latch is broken and the window won't stay closed.", category: "Infrastructure", priority: "Medium", location: "Block B, Room 105", status: "Resolved", ago: 260, start: 8, resolve: 22, assignee: "tech-a", mine: true, resolution: "Fitted a new latch.", feedback: { rating: 4, comment: "Thanks!" } },
  { id: "v19", title: "Parking gate barrier stuck", description: "The barrier at the main gate stays down and cars are queuing.", category: "Infrastructure", priority: "High", location: "Main gate parking", status: "Resolved", ago: 300, start: 1, resolve: 4, assignee: "tech-a", resolution: "Reset the barrier controller.", claim: { amount: 2500, description: "Barrier motor relay", status: "rejected" } },
  { id: "v20", title: "Dusty corridor after construction", description: "Construction dust covers the ground-floor corridor.", category: "Cleanliness", priority: "Low", location: "Block C, ground floor", status: "Resolved", ago: 180, start: 24, resolve: 60, assignee: "tech-b", resolution: "Corridor cleaned and mopped." },
  { id: "v21", title: "Water cooler not working", description: "The water cooler in the changing rooms gives no water.", category: "Plumbing", priority: "Medium", location: "Sports Complex, changing rooms", status: "Resolved", ago: 230, start: 6, resolve: 20, assignee: "tech-b", resolution: "Replaced the inlet valve.", feedback: { rating: 5, comment: "" } },
  { id: "v22", title: "Ceiling fan noisy in Room 301", description: "The ceiling fan makes a loud grinding noise.", category: "Electrical", priority: "Low", location: "Block D, Room 301", status: "Resolved", ago: 300, start: 30, resolve: 80, assignee: "tech-a", resolution: "Lubricated the bearing and balanced the blades.", feedback: { rating: 3, comment: "" } },
  { id: "v23", title: "Lift button not working", description: "The ground-floor call button for the lift doesn't respond.", category: "Infrastructure", priority: "High", location: "Administration block, lift", status: "Resolved", ago: 20, start: 1, resolve: 5, assignee: "tech-a", resolution: "Replaced the faulty call button." },
  { id: "v24", title: "Hedge blocking walkway", description: "An overgrown hedge narrows the path to the hostel entrance.", category: "Landscaping", priority: "Low", location: "Hostel Block 1, front lawn", status: "Resolved", ago: 280, start: 40, resolve: 70, assignee: "tech-b", resolution: "Hedge trimmed back from the walkway." },
];

export interface DemoData {
  now: Date;
  issues: DemoIssue[];
}

/** Build the sample dataset relative to `now` (pure and deterministic). */
export function buildDemoData(now: Date): DemoData {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR);
  const issues = SPECS.map((s): DemoIssue => {
    const createdAt = at(s.ago);
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      category: s.category,
      priority: s.priority,
      status: s.status,
      location: s.location,
      locationId: "",
      assignedTo: s.assignee ?? "",
      duplicateOf: s.duplicateOf ?? "",
      createdAt,
      startedAt: s.start !== undefined ? at(s.ago - s.start) : undefined,
      resolvedAt: s.resolve !== undefined ? at(s.ago - s.resolve) : undefined,
      escalated: s.escalated ?? false,
      mine: s.mine ?? false,
      resolutionSummary: s.resolution ?? "",
      feedback: s.feedback,
      claim: s.claim,
    };
  });
  return { now, issues };
}

export function technicianLabel(id: string): string {
  return DEMO_TECHNICIANS.find((t) => t.id === id)?.label ?? "Unassigned";
}

/** Timeline derived from the issue's own fields (the same lifecycle the real app records). */
export function demoTimeline(issue: DemoIssue): DemoEvent[] {
  const events: DemoEvent[] = [
    { type: "reported", at: issue.createdAt, text: `Reported · suggested category ${issue.category}, ${issue.priority.toLowerCase()} priority` },
  ];
  if (issue.duplicateOf) events.push({ type: "linked", at: issue.createdAt, text: "Linked to an existing report of the same problem" });
  if (issue.assignedTo) {
    const assignedAt = new Date(Math.min(issue.startedAt?.getTime() ?? issue.createdAt.getTime() + HOUR / 2, issue.createdAt.getTime() + HOUR / 2));
    events.push({ type: "assigned", at: assignedAt, text: `Assigned to ${technicianLabel(issue.assignedTo)}` });
  }
  if (issue.startedAt) events.push({ type: "started", at: issue.startedAt, text: "Work started" });
  if (issue.resolvedAt) events.push({ type: "resolved", at: issue.resolvedAt, text: issue.resolutionSummary ? `Resolved · ${issue.resolutionSummary}` : "Resolved" });
  if (issue.claim && issue.resolvedAt) {
    const decided = new Date(issue.resolvedAt.getTime() + 2 * HOUR);
    if (issue.claim.status === "approved") events.push({ type: "claim_approved", at: decided, text: "Expense claim approved by an administrator" });
    if (issue.claim.status === "rejected") events.push({ type: "claim_rejected", at: decided, text: "Expense claim rejected by an administrator" });
  }
  if (issue.feedback && issue.resolvedAt) {
    events.push({ type: "feedback", at: new Date(issue.resolvedAt.getTime() + 3 * HOUR), text: `Reporter rated the fix ${issue.feedback.rating}/5` });
  }
  return events;
}
