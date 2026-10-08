// ============================================
// Viewer Mode demo dataset
// ============================================
// A synthetic campus for the public Viewer. Nothing here comes from or goes
// to Firestore: every person, issue, claim and payment is invented, and the
// names are fictional. Buildings are the schematic layout in lib/campus.ts.
//
// The dataset is generated from the templates below with a fixed-seed
// random generator, so it is identical on every visit. Times are offsets
// from the moment the page opens, which keeps deadlines (on track / due
// soon / overdue) meaningful whenever it is viewed. Every figure shown in
// Viewer Mode is computed from this data (see demoStats.ts).

import { IssueEventType, IssueStatus, IssueSummary, Priority } from "@/types";
import { DEFAULT_SLA_HOURS, departmentFor } from "@/lib/constants";

const HOUR = 3_600_000;

/** Days of history in the dataset. */
export const DEMO_WINDOW_DAYS = 30;
export const DEMO_BUDGET_TOTAL = 250_000;

export type DemoRole = "student" | "worker" | "admin";

// ---------- People ----------

export interface DemoStudent {
  id: string;
  name: string;
  department: string;
  year: string;
}

export interface DemoWorker {
  id: string;
  name: string;
  team: string;
  /** Categories this technician usually handles. */
  skills: string[];
  shift: "Day" | "Evening";
}

export const DEMO_WORKERS: DemoWorker[] = [
  { id: "w01", name: "Ramesh Kumar", team: "Electrical Maintenance", skills: ["Electrical"], shift: "Day" },
  { id: "w02", name: "Suresh Yadav", team: "Electrical Maintenance", skills: ["Electrical", "Infrastructure"], shift: "Evening" },
  { id: "w03", name: "Anil Verma", team: "Plumbing & Water", skills: ["Plumbing"], shift: "Day" },
  { id: "w04", name: "Mohammed Irfan", team: "Plumbing & Water", skills: ["Plumbing", "Infrastructure"], shift: "Evening" },
  { id: "w05", name: "Lakshmi Devi", team: "Housekeeping", skills: ["Cleanliness"], shift: "Day" },
  { id: "w06", name: "Sunita Rao", team: "Housekeeping", skills: ["Cleanliness", "Landscaping"], shift: "Day" },
  { id: "w07", name: "Prakash Reddy", team: "IT Services", skills: ["IT"], shift: "Day" },
  { id: "w08", name: "Kavya Nair", team: "IT Services", skills: ["IT", "General"], shift: "Evening" },
  { id: "w09", name: "Venkat Naidu", team: "Facilities & Furniture", skills: ["Furniture", "Infrastructure"], shift: "Day" },
  { id: "w10", name: "Joseph Mathew", team: "Campus Security", skills: ["Safety"], shift: "Evening" },
  { id: "w11", name: "Ravi Shankar", team: "Grounds & Gardens", skills: ["Landscaping", "Cleanliness"], shift: "Day" },
  { id: "w12", name: "Farhan Ali", team: "Civil & Estates", skills: ["Infrastructure", "Furniture", "General"], shift: "Day" },
];

const FIRST_NAMES = ["Aarav", "Ananya", "Rohan", "Sneha", "Karthik", "Priya", "Arjun", "Meera", "Vikram", "Divya", "Nikhil", "Pooja", "Siddharth", "Ishita", "Rahul", "Tanvi", "Aditya", "Nandini"];
const LAST_NAMES = ["Sharma", "Reddy", "Iyer"];
const DEPARTMENTS = ["Computer Science", "Electronics", "Mechanical", "Civil", "Electrical", "Information Technology", "Business Administration", "Physics", "Chemistry"];
const YEARS = ["1st year", "2nd year", "3rd year", "4th year"];

export const DEMO_STUDENTS: DemoStudent[] = FIRST_NAMES.flatMap((first, i) =>
  LAST_NAMES.map((last, j) => ({
    id: `s${String(i * LAST_NAMES.length + j + 1).padStart(2, "0")}`,
    name: `${first} ${last}`,
    department: DEPARTMENTS[(i * 2 + j) % DEPARTMENTS.length],
    year: YEARS[(i + j * 3) % YEARS.length],
  }))
);

/** The accounts whose point of view each perspective shows. */
export const DEMO_PERSONA = {
  student: DEMO_STUDENTS[0],
  worker: DEMO_WORKERS[0],
  admin: { id: "a01", name: "Dr. Meera Krishnan", title: "Estate Office" },
} as const;

/** People waiting for an administrator to approve worker access. */
export const DEMO_WORKER_REQUESTS = [
  { id: "r01", name: "Deepak Joshi", team: "Electrical Maintenance", requestedHoursAgo: 20 },
  { id: "r02", name: "Shabana Begum", team: "Housekeeping", requestedHoursAgo: 51 },
];

// ---------- Places ----------

type Zone = "class" | "lab" | "wash" | "hall" | "outdoor" | "office" | "hostel" | "canteen" | "library" | "sports" | "gate";

export interface DemoLocation {
  id: string;
  /** Full location text (matches a building in lib/campus.ts). */
  name: string;
  buildingId: string;
  floor: string;
  room: string;
  /** How the place reads inside a sentence ("Room 104", "the reading room"). */
  spot: string;
  zones: Zone[];
}

export const DEMO_LOCATIONS: DemoLocation[] = [
  { id: "a-104", name: "Block A, Room 104", buildingId: "block-a", floor: "1", room: "104", spot: "Room 104", zones: ["class"] },
  { id: "a-201", name: "Block A, Room 201", buildingId: "block-a", floor: "2", room: "201", spot: "Room 201", zones: ["class"] },
  { id: "b-105", name: "Block B, Room 105", buildingId: "block-b", floor: "1", room: "105", spot: "Room 105", zones: ["class"] },
  { id: "b-wash", name: "Block B, ground-floor washroom", buildingId: "block-b", floor: "G", room: "", spot: "the ground-floor washroom", zones: ["wash"] },
  { id: "c-corr", name: "Block C, second-floor corridor", buildingId: "block-c", floor: "2", room: "", spot: "the second-floor corridor", zones: ["hall"] },
  { id: "c-staff", name: "Block C, staff room", buildingId: "block-c", floor: "1", room: "", spot: "the staff room", zones: ["office"] },
  { id: "d-210", name: "Block D, Room 210", buildingId: "block-d", floor: "2", room: "210", spot: "Room 210", zones: ["class"] },
  { id: "d-301", name: "Block D, Room 301", buildingId: "block-d", floor: "3", room: "301", spot: "Room 301", zones: ["class"] },
  { id: "e-12", name: "Block E, Room 12", buildingId: "block-e", floor: "G", room: "12", spot: "Room 12", zones: ["class"] },
  { id: "lib-read", name: "Central Library, reading room", buildingId: "library", floor: "1", room: "", spot: "the reading room", zones: ["library"] },
  { id: "lib-desk", name: "Central Library, help desk", buildingId: "library", floor: "G", room: "", spot: "the library help desk", zones: ["library", "office"] },
  { id: "lab-cs3", name: "Laboratory Complex, Computer Lab 3", buildingId: "labs", floor: "1", room: "3", spot: "Computer Lab 3", zones: ["lab"] },
  { id: "lab-phy", name: "Laboratory Complex, Physics Lab", buildingId: "labs", floor: "G", room: "", spot: "the Physics Lab", zones: ["lab"] },
  { id: "lab-mech", name: "Laboratory Complex, Mechanical Workshop", buildingId: "labs", floor: "G", room: "", spot: "the Mechanical Workshop", zones: ["lab"] },
  { id: "adm-lift", name: "Administration block, lift lobby", buildingId: "admin", floor: "G", room: "", spot: "the lift lobby", zones: ["hall"] },
  { id: "adm-acc", name: "Administration block, accounts office", buildingId: "admin", floor: "1", room: "", spot: "the accounts office", zones: ["office"] },
  { id: "aud-hall", name: "Auditorium, seminar hall", buildingId: "auditorium", floor: "G", room: "", spot: "the seminar hall", zones: ["hall", "class"] },
  { id: "aud-exit", name: "Auditorium, rear exit", buildingId: "auditorium", floor: "G", room: "", spot: "the rear exit", zones: ["hall"] },
  { id: "can-kit", name: "Canteen, kitchen", buildingId: "canteen", floor: "G", room: "", spot: "the canteen kitchen", zones: ["canteen", "wash"] },
  { id: "can-out", name: "Canteen, outdoor seating", buildingId: "canteen", floor: "G", room: "", spot: "the canteen seating area", zones: ["canteen", "outdoor"] },
  { id: "hos-1", name: "Hostel Block 1, main staircase", buildingId: "hostel", floor: "1", room: "", spot: "the Hostel 1 staircase", zones: ["hostel", "hall"] },
  { id: "hos-2", name: "Hostel Block 2, first-floor washroom", buildingId: "hostel", floor: "1", room: "", spot: "the Hostel 2 washroom", zones: ["hostel", "wash"] },
  { id: "spo-ground", name: "Sports Complex, main ground", buildingId: "sports", floor: "G", room: "", spot: "the main ground", zones: ["sports", "outdoor"] },
  { id: "spo-change", name: "Sports Complex, changing rooms", buildingId: "sports", floor: "G", room: "", spot: "the changing rooms", zones: ["sports", "wash"] },
  { id: "gate-main", name: "Main gate parking", buildingId: "parking", floor: "G", room: "", spot: "the main gate", zones: ["gate", "outdoor"] },
  { id: "gate-north", name: "North gate, security cabin", buildingId: "parking", floor: "G", room: "", spot: "the north gate", zones: ["gate", "outdoor"] },
];

export function demoLocation(id: string): DemoLocation | undefined {
  return DEMO_LOCATIONS.find((l) => l.id === id);
}

// ---------- Issue templates ----------

interface Template {
  category: string;
  /** "{p}" is replaced by the location's spot. */
  title: string;
  description: string;
  priority: Priority;
  zones: Zone[];
  fix: string;
  /** Typical purchase when the repair needs parts: [what, rupees]. */
  parts?: [string, number];
}

const T = (category: string, title: string, description: string, priority: Priority, zones: Zone[], fix: string, parts?: [string, number]): Template => ({
  category,
  title,
  description,
  priority,
  zones,
  fix,
  parts,
});

const TEMPLATES: Template[] = [
  T("Electrical", "Projector not turning on in {p}", "The ceiling projector shows no power light. Classes are running on the whiteboard only.", "High", ["class", "lab"], "Replaced the blown power supply board and tested with a laptop.", ["Projector power board", 2400]),
  T("Electrical", "Flickering tube light in {p}", "One of the tube lights flickers constantly and gives people a headache during long sessions.", "Low", ["class", "library", "office", "hall"], "Replaced the tube with an LED fitting.", ["LED tube light", 320]),
  T("Electrical", "AC not cooling in {p}", "The air conditioner runs but the room stays warm, especially in the afternoon.", "Medium", ["class", "lab", "office", "library"], "Cleaned the filters and topped up the refrigerant gas.", ["Refrigerant gas refill", 1800]),
  T("Electrical", "Power socket sparking in {p}", "A wall socket sparks when a charger is plugged in. It has been taped over for now.", "High", ["class", "lab", "hostel", "library"], "Isolated the circuit and replaced the socket and faceplate.", ["Socket and faceplate", 260]),
  T("Electrical", "Ceiling fan making noise in {p}", "The ceiling fan makes a loud grinding noise at every speed.", "Low", ["class", "hostel", "canteen"], "Lubricated the bearing and balanced the blades."),
  T("Electrical", "Pathway lights not working near {p}", "Several pathway lights stay off after dark, so the walk back is very dim.", "Medium", ["outdoor", "gate", "sports"], "Replaced the faulty photo sensor and two lamps.", ["Photo sensor and lamps", 950]),
  T("Plumbing", "Water leaking in {p}", "Water is pooling on the floor from a pipe joint. The floor is slippery.", "High", ["wash", "lab", "canteen"], "Tightened the joint and replaced the worn washer.", ["Pipe washers and sealant", 180]),
  T("Plumbing", "Tap dripping in {p}", "A tap keeps dripping after it is closed fully.", "Low", ["wash", "canteen", "hostel"], "Replaced the worn tap cartridge and checked for leaks.", ["Tap cartridge", 450]),
  T("Plumbing", "Water dispenser not working at {p}", "The drinking water dispenser gives no water even though the tank is full.", "Medium", ["hall", "canteen", "library", "sports"], "Replaced the inlet valve and flushed the line.", ["Dispenser inlet valve", 700]),
  T("Plumbing", "Blocked drain in {p}", "The floor drain is blocked and dirty water is backing up.", "High", ["wash", "canteen"], "Cleared the drain line and flushed the trap.", ["Drain cleaning rods", 900]),
  T("Plumbing", "Flush not working in {p}", "The flush handle moves freely but nothing happens.", "Medium", ["wash", "hostel"], "Replaced the flush valve assembly.", ["Flush valve kit", 520]),
  T("IT", "Wi-Fi keeps dropping in {p}", "The wireless connection drops every few minutes and interrupts online work.", "High", ["lab", "library", "class", "hostel"], "Moved the access point to a clear channel and updated its firmware."),
  T("IT", "Smart board not responding in {p}", "The smart board does not react to touch or the pen.", "Medium", ["class", "hall"], "Recalibrated the touch panel and reinstalled the driver."),
  T("IT", "Lab computers will not boot in {p}", "Four machines in the back row stop at a black screen on start-up.", "Medium", ["lab"], "Reseated the memory and re-imaged two machines.", ["Replacement RAM module", 1650]),
  T("IT", "Printer jamming at {p}", "The shared printer jams on almost every job.", "Low", ["library", "office"], "Removed a torn sheet and replaced the pickup roller.", ["Pickup roller", 380]),
  T("IT", "Network port dead in {p}", "The wired network port on the wall gives no link light.", "Low", ["office", "lab"], "Re-terminated the cable at the patch panel."),
  T("Infrastructure", "Broken window latch in {p}", "The window latch is broken, so the window will not stay closed in the wind.", "Medium", ["class", "hostel", "office"], "Fitted a new latch and adjusted the hinge.", ["Window latch set", 240]),
  T("Infrastructure", "Door will not close properly in {p}", "The door scrapes the floor and does not lock.", "Low", ["class", "office", "hostel", "lab"], "Planed the door edge and re-hung the hinges."),
  T("Infrastructure", "Ceiling plaster falling in {p}", "Pieces of ceiling plaster are falling near the back wall after the rain.", "High", ["class", "hall", "hostel"], "Removed the loose plaster, sealed the seepage and re-plastered the patch.", ["Plaster and sealant", 1350]),
  T("Infrastructure", "Lift call button not responding at {p}", "The lift call button does not light up or call the lift.", "High", ["hall"], "Replaced the faulty call button unit.", ["Lift call button unit", 1900]),
  T("Infrastructure", "Barrier stuck at {p}", "The entry barrier stays down and vehicles are queuing onto the road.", "High", ["gate"], "Reset the barrier controller and replaced the relay.", ["Barrier motor relay", 2500]),
  T("Cleanliness", "Overflowing bins near {p}", "The bins are full and litter is spreading around them.", "Medium", ["outdoor", "canteen", "hall"], "Emptied the bins and added one more collection round."),
  T("Cleanliness", "Washroom needs cleaning at {p}", "The washroom has not been cleaned today and there is no soap.", "Medium", ["wash"], "Deep-cleaned the washroom and restocked soap."),
  T("Cleanliness", "Dust after repair work in {p}", "Repair dust covers the floor and the desks.", "Low", ["class", "hall", "lab"], "Area swept, mopped and wiped down."),
  T("Cleanliness", "Stagnant water near {p}", "Water has collected for days and mosquitoes are breeding.", "Medium", ["outdoor", "hostel", "sports"], "Drained the water and levelled the low patch."),
  T("Safety", "Exit sign not lit at {p}", "The emergency exit sign is not illuminated.", "Medium", ["hall"], "Replaced the sign battery pack and tested it.", ["Exit sign battery pack", 640]),
  T("Safety", "Loose handrail at {p}", "The handrail moves when you hold it.", "High", ["hall", "hostel"], "Re-fixed the handrail with new wall brackets.", ["Wall brackets and fixings", 1200]),
  T("Safety", "Fire extinguisher expired in {p}", "The extinguisher tag shows that the service date has passed.", "Medium", ["lab", "hall", "canteen", "library"], "Swapped in a serviced extinguisher and updated the tag.", ["Extinguisher refill", 850]),
  T("Safety", "CCTV camera offline at {p}", "The camera shows no feed on the security monitor.", "Medium", ["gate", "hall", "outdoor"], "Replaced the damaged cable and realigned the camera."),
  T("Furniture", "Broken chair in {p}", "A chair has a cracked leg and wobbles.", "Low", ["class", "library", "canteen", "lab"], "Replaced the cracked leg and tightened the frame."),
  T("Furniture", "Desk drawers jammed in {p}", "Two desk drawers are jammed shut and cannot be used.", "Low", ["office", "library"], "Realigned the runners and waxed the slides."),
  T("Furniture", "Whiteboard coming off the wall in {p}", "The whiteboard has come loose at one corner and leans forward.", "Medium", ["class", "lab"], "Re-mounted the board with new anchor bolts.", ["Anchor bolts", 150]),
  T("Furniture", "Cupboard lock broken in {p}", "The cupboard lock turns but does not catch.", "Low", ["office", "hostel", "lab"], "Fitted a new cam lock with two keys.", ["Cam lock", 210]),
  T("Landscaping", "Overgrown hedge near {p}", "The hedge has grown over the path and narrows it.", "Low", ["outdoor", "hostel", "gate"], "Hedge trimmed back from the walkway."),
  T("Landscaping", "Sprinkler broken at {p}", "A sprinkler head is broken and leaves a dry patch.", "Low", ["sports", "outdoor"], "Replaced the sprinkler head and reset the timer.", ["Sprinkler head", 340]),
  T("Landscaping", "Fallen branch near {p}", "A large branch has fallen across the path after the storm.", "Medium", ["outdoor", "gate", "sports"], "Cut and cleared the branch and checked the tree."),
  T("General", "Notice board glass cracked at {p}", "The glass on the notice board is cracked along one side.", "Low", ["hall", "library"], "Replaced the glass pane.", ["Glass pane", 780]),
  T("General", "Lost and found locker jammed at {p}", "The lost-and-found locker will not open with its key.", "Low", ["office", "gate"], "Freed the lock and issued a new key."),
];

// ---------- Issues ----------

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
  reporterId: string;
  reporterName: string;
  /** Reported by the student whose view the Student perspective shows. */
  mine: boolean;
  upvotes: number;
  /** Whether the report carries a (generated) sample photo. */
  hasPhoto: boolean;
  aiConfidence: number;
  aiDepartment: string;
  resolutionSummary: string;
  feedback?: DemoFeedback;
  claim?: DemoClaim;
  /** Created during this visit by a simulated action. */
  simulated?: boolean;
}

export interface DemoEvent {
  type: IssueEventType;
  at: Date;
  text: string;
}

export interface DemoData {
  now: Date;
  issues: DemoIssue[];
}

/** Small deterministic generator (mulberry32) so the dataset never changes between visits. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEEDBACK_COMMENTS: Record<number, string[]> = {
  5: ["Fixed the same day, thank you.", "Quick and neat work.", "Works perfectly now.", ""],
  4: ["Good, took a little while.", "Sorted. Thanks!", ""],
  3: ["Works now, but it took a while.", "Okay, though it needed a second visit.", ""],
  2: ["The problem came back the next day.", "Only partly fixed."],
  1: ["Still not working properly."],
};

interface Spec {
  id: string;
  template: number;
  location: string;
  status: IssueStatus;
  /** Hours before "now" the issue was reported. */
  ago: number;
  /** Hours after reporting that work started / it was resolved. */
  start?: number;
  resolve?: number;
  assignee?: string;
  reporter?: string;
  duplicateOf?: string;
  escalated?: boolean;
  priority?: Priority;
  feedback?: DemoFeedback;
  claim?: DemoClaim["status"];
  upvotes?: number;
}

const ME = DEMO_PERSONA.student.id;

/**
 * The live part of the campus: open and in-progress work written by hand so
 * every deadline state, an incident and each role's queue are always present.
 */
const LIVE: Spec[] = [
  { id: "SC-1140", template: 0, location: "a-104", status: "In Progress", ago: 4.5, start: 1, assignee: "w01", reporter: ME, upvotes: 7 },
  { id: "SC-1141", template: 0, location: "a-104", status: "Open", ago: 3, duplicateOf: "SC-1140", upvotes: 2 },
  { id: "SC-1139", template: 6, location: "b-wash", status: "Open", ago: 9, assignee: "w03", escalated: true, upvotes: 9 },
  { id: "SC-1136", template: 2, location: "aud-hall", status: "In Progress", ago: 20, start: 6, assignee: "w01", upvotes: 5 },
  { id: "SC-1137", template: 1, location: "c-corr", status: "Open", ago: 10, assignee: "w01", reporter: ME, upvotes: 1 },
  { id: "SC-1142", template: 11, location: "lab-cs3", status: "Open", ago: 2, assignee: "w07", upvotes: 11 },
  { id: "SC-1143", template: 11, location: "lab-cs3", status: "Open", ago: 1, duplicateOf: "SC-1142", reporter: ME, upvotes: 3 },
  { id: "SC-1144", template: 11, location: "lab-cs3", status: "Open", ago: 0.6, duplicateOf: "SC-1142", upvotes: 1 },
  { id: "SC-1128", template: 29, location: "lib-read", status: "In Progress", ago: 60, start: 30, assignee: "w09", upvotes: 0 },
  { id: "SC-1133", template: 21, location: "can-out", status: "Open", ago: 30, upvotes: 6 },
  { id: "SC-1119", template: 34, location: "spo-ground", status: "Open", ago: 100, assignee: "w11", upvotes: 2 },
  { id: "SC-1138", template: 25, location: "aud-exit", status: "Open", ago: 4, upvotes: 4 },
  { id: "SC-1135", template: 3, location: "lab-phy", status: "In Progress", ago: 5.2, start: 0.5, assignee: "w02", upvotes: 8 },
  { id: "SC-1134", template: 8, location: "lib-desk", status: "Open", ago: 19, assignee: "w04", upvotes: 3 },
  { id: "SC-1132", template: 18, location: "hos-1", status: "In Progress", ago: 7, start: 2, assignee: "w12", escalated: true, upvotes: 12 },
  { id: "SC-1131", template: 13, location: "lab-cs3", status: "Open", ago: 26, assignee: "w08", upvotes: 4 },
  { id: "SC-1130", template: 22, location: "hos-2", status: "Open", ago: 15, reporter: ME, upvotes: 5 },
  { id: "SC-1129", template: 5, location: "gate-north", status: "Open", ago: 44, assignee: "w02", upvotes: 6 },
  { id: "SC-1145", template: 16, location: "b-105", status: "Open", ago: 0.3, upvotes: 0 },
  { id: "SC-1127", template: 27, location: "can-kit", status: "Open", ago: 22, upvotes: 2 },
  // Recently resolved work for the personas, so "rate a fix" and claims are always visible.
  { id: "SC-1121", template: 7, location: "hos-2", status: "Resolved", ago: 70, start: 4, resolve: 18, assignee: "w03", reporter: ME, feedback: { rating: 5, comment: "Fixed the same day, thank you." }, claim: "approved", upvotes: 2 },
  { id: "SC-1124", template: 26, location: "hos-1", status: "Resolved", ago: 50, start: 1, resolve: 5, assignee: "w01", claim: "pending", upvotes: 10 },
  { id: "SC-1126", template: 19, location: "adm-lift", status: "Resolved", ago: 28, start: 1, resolve: 5, assignee: "w01", claim: "pending", upvotes: 14 },
  { id: "SC-1123", template: 16, location: "b-105", status: "Resolved", ago: 54, start: 8, resolve: 22, assignee: "w12", reporter: ME, upvotes: 1 },
  { id: "SC-1125", template: 3, location: "a-201", status: "Resolved", ago: 36, start: 1, resolve: 4, assignee: "w01", claim: "approved", feedback: { rating: 4, comment: "Sorted. Thanks!" }, upvotes: 3 },
];

const HISTORY_COUNT = 104;

function historySpecs(): Spec[] {
  const next = rng(20261004);
  const pick = <V,>(list: V[]): V => list[Math.floor(next() * list.length)];
  const specs: Spec[] = [];
  for (let n = 0; n < HISTORY_COUNT; n++) {
    const template = Math.floor(next() * TEMPLATES.length);
    const t = TEMPLATES[template];
    const places = DEMO_LOCATIONS.filter((l) => l.zones.some((z) => t.zones.includes(z)));
    const location = pick(places).id;
    // Spread over the window, slightly denser in the last two weeks; nothing newer than three days.
    const ago = 72 + Math.pow(next(), 1.25) * (DEMO_WINDOW_DAYS * 24 - 160);
    const target = DEFAULT_SLA_HOURS[t.priority];
    // Most work lands inside its target; roughly one in five overruns.
    const resolve = Math.min(ago - 2, Math.max(1.5, target * (next() < 0.8 ? 0.15 + next() * 0.75 : 1.1 + next() * 1.2)));
    const start = Math.max(0.3, resolve * (0.1 + next() * 0.4));
    const skilled = DEMO_WORKERS.filter((w) => w.skills.includes(t.category));
    const assignee = pick(skilled.length ? skilled : DEMO_WORKERS).id;
    const reporter = next() < 0.07 ? ME : pick(DEMO_STUDENTS).id;
    let feedback: DemoFeedback | undefined;
    if (next() < 0.62) {
      const late = resolve > target;
      const roll = next();
      const rating = late ? (roll < 0.35 ? 2 : roll < 0.75 ? 3 : 4) : roll < 0.5 ? 5 : roll < 0.85 ? 4 : roll < 0.95 ? 3 : 2;
      feedback = { rating, comment: pick(FEEDBACK_COMMENTS[rating]) };
    }
    let claim: DemoClaim["status"] | undefined;
    if (t.parts && next() < 0.55) {
      const roll = next();
      claim = ago < 130 && roll < 0.35 ? "pending" : roll < 0.9 ? "approved" : "rejected";
    }
    specs.push({ id: `SC-${1000 + n}`, template, location, status: "Resolved", ago, start, resolve, assignee, reporter, feedback, claim, upvotes: Math.floor(next() * next() * 14) });
  }
  return specs.sort((a, b) => b.ago - a.ago).map((s, i) => ({ ...s, id: `SC-${1000 + i}` }));
}

const SPECS: Spec[] = [...historySpecs(), ...LIVE];

function build(spec: Spec, now: Date, index: number): DemoIssue {
  const t = TEMPLATES[spec.template];
  const place = demoLocation(spec.location)!;
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR);
  const reporter = DEMO_STUDENTS.find((s) => s.id === spec.reporter) ?? DEMO_STUDENTS[(index * 7 + 3) % DEMO_STUDENTS.length];
  const claim: DemoClaim | undefined = spec.claim && t.parts ? { amount: t.parts[1], description: t.parts[0], status: spec.claim } : undefined;
  return {
    id: spec.id,
    title: t.title.replace("{p}", place.spot),
    description: t.description,
    category: t.category,
    priority: spec.priority ?? t.priority,
    status: spec.status,
    location: place.name,
    locationId: place.id,
    assignedTo: spec.assignee ?? "",
    duplicateOf: spec.duplicateOf ?? "",
    createdAt: at(spec.ago),
    startedAt: spec.start !== undefined ? at(spec.ago - spec.start) : undefined,
    resolvedAt: spec.resolve !== undefined ? at(spec.ago - spec.resolve) : undefined,
    escalated: spec.escalated ?? false,
    reporterId: reporter.id,
    reporterName: reporter.name,
    mine: reporter.id === ME,
    upvotes: spec.upvotes ?? 0,
    hasPhoto: index % 5 !== 0,
    aiConfidence: 0.62 + ((index * 37) % 33) / 100,
    aiDepartment: departmentFor(t.category),
    resolutionSummary: spec.status === "Resolved" ? t.fix : "",
    feedback: spec.feedback,
    claim,
  };
}

/** Build the demo dataset relative to `now` (pure and deterministic). */
export function buildDemoData(now: Date): DemoData {
  return { now, issues: SPECS.map((s, i) => build(s, now, i)) };
}

export function workerName(id: string): string {
  return DEMO_WORKERS.find((w) => w.id === id)?.name ?? "Unassigned";
}

/** Timeline derived from the issue's own fields (the same lifecycle the real app records). */
export function demoTimeline(issue: DemoIssue, now?: Date): DemoEvent[] {
  const events: DemoEvent[] = [
    { type: "reported", at: issue.createdAt, text: `Reported by ${issue.reporterName} · suggested ${issue.category}, ${issue.priority.toLowerCase()} priority` },
  ];
  if (issue.duplicateOf) events.push({ type: "linked", at: new Date(issue.createdAt.getTime() + 60_000), text: `Linked to ${issue.duplicateOf} as the same problem` });
  if (issue.assignedTo) {
    const assignedAt = new Date(Math.min(issue.startedAt?.getTime() ?? Infinity, issue.createdAt.getTime() + HOUR / 2));
    events.push({ type: "assigned", at: assignedAt, text: `Assigned to ${workerName(issue.assignedTo)}` });
  }
  if (issue.startedAt) events.push({ type: "started", at: issue.startedAt, text: "Work started" });
  if (issue.resolvedAt) events.push({ type: "resolved", at: issue.resolvedAt, text: issue.resolutionSummary ? `Resolved · ${issue.resolutionSummary}` : "Resolved" });
  if (issue.claim && issue.resolvedAt) {
    const decided = new Date(issue.resolvedAt.getTime() + 2 * HOUR);
    if (issue.claim.status === "approved") events.push({ type: "claim_approved", at: decided, text: "Expense claim approved and paid" });
    if (issue.claim.status === "rejected") events.push({ type: "claim_rejected", at: decided, text: "Expense claim rejected" });
  }
  if (issue.feedback && issue.resolvedAt) {
    events.push({ type: "feedback", at: new Date(issue.resolvedAt.getTime() + 3 * HOUR), text: `${issue.reporterName} rated the fix ${issue.feedback.rating}/5` });
  }
  // A decision or rating that would fall after "now" has not happened yet.
  return events.filter((e) => !now || e.at.getTime() <= now.getTime()).sort((a, b) => a.at.getTime() - b.at.getTime());
}
