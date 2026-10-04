#!/usr/bin/env node
// ============================================
// Demo data for the LOCAL Firebase Emulator Suite only
// ============================================
// Usage (emulators must be running, e.g. `npx firebase-tools emulators:start --project demo-unifix`):
//   npm run seed:emulator -- --issues=200 [--reset]
//
// Safety: this script refuses to run unless the target is a local emulator
// (127.0.0.1 / localhost) AND the project id starts with "demo-" (Firebase
// "demo" projects can never reach real cloud resources). It writes with the
// emulator's admin bypass, which only exists on the emulator.
//
// Demo accounts (emulator only — never use these values anywhere real):
//   admin@unifix.test, worker1..3@unifix.test, student1..5@unifix.test
//   password: SEED_PASSWORD env var, or "emulator-only-demo" by default.

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);

const PROJECT = process.env.SEED_PROJECT_ID || "demo-unifix";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const PASSWORD = process.env.SEED_PASSWORD || "emulator-only-demo";
const ISSUE_COUNT = Math.min(5000, Math.max(0, Number(args.issues ?? 120) || 0));

function isLocal(host) {
  return /^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(host);
}

if (!PROJECT.startsWith("demo-") || !isLocal(FIRESTORE_HOST) || !isLocal(AUTH_HOST)) {
  console.error(
    `Refusing to seed: project "${PROJECT}" / hosts ${FIRESTORE_HOST}, ${AUTH_HOST}.\n` +
      "This script only runs against local emulators with a demo- project id."
  );
  process.exit(1);
}

const DB = `http://${FIRESTORE_HOST}/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { Authorization: "Bearer owner", "Content-Type": "application/json" };

// ---------- deterministic pseudo-random ----------
let seed = Number(args.seed ?? 20261003);
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(rand() * list.length)];

// ---------- Firestore REST value encoding ----------
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(enc) } : {} };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
}

const writes = [];
function put(path, data) {
  writes.push({
    update: {
      name: `projects/${PROJECT}/databases/(default)/documents/${path}`,
      fields: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)])),
    },
  });
}

async function flush() {
  for (let i = 0; i < writes.length; i += 400) {
    const res = await fetch(`${DB}:commit`, { method: "POST", headers: OWNER, body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
    if (!res.ok) throw new Error(`commit failed: ${res.status} ${await res.text()}`);
  }
  writes.length = 0;
}

async function account(email, name) {
  const base = `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1`;
  const body = JSON.stringify({ email, password: PASSWORD, displayName: name, returnSecureToken: true });
  let res = await fetch(`${base}/accounts:signUp?key=demo-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!res.ok) {
    res = await fetch(`${base}/accounts:signInWithPassword?key=demo-key`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  }
  if (!res.ok) throw new Error(`auth emulator: ${email}: ${res.status} ${await res.text()}`);
  return (await res.json()).localId;
}

// ---------- realistic content ----------
const DEPARTMENTS = {
  Electrical: "Electrical Maintenance", Plumbing: "Plumbing & Water", Infrastructure: "Civil & Estates",
  Cleanliness: "Housekeeping", Safety: "Campus Security", IT: "IT Services", Furniture: "Facilities & Furniture",
  Landscaping: "Grounds & Gardens", General: "Facilities Helpdesk",
};
const TEMPLATES = {
  Electrical: ["Tube light flickering", "Power socket not working", "Fan making noise and not rotating", "AC not cooling", "Projector has no power"],
  Plumbing: ["Water leakage under sink", "Tap leaking continuously", "Washroom flush not working", "No water supply in restroom", "Water cooler leaking"],
  Infrastructure: ["Crack in classroom wall", "Ceiling plaster falling", "Broken window pane", "Damaged staircase step", "Door hinge broken"],
  Cleanliness: ["Garbage bin overflowing", "Washroom not cleaned", "Corridor floor very dirty", "Bad smell near drain", "Spilled waste not cleared"],
  Safety: ["Fire extinguisher expired", "Exposed electrical wire", "Emergency exit blocked", "CCTV camera not working", "Broken railing on balcony"],
  IT: ["WiFi not working", "Lab computer not booting", "Network very slow", "Printer not responding", "Smart board not connecting"],
  Furniture: ["Broken chair in classroom", "Desk wobbling", "Bench damaged", "Cupboard lock broken", "Whiteboard loose on wall"],
  Landscaping: ["Overgrown grass near path", "Fallen tree branch", "Garden sprinkler broken", "Dry plants need watering", "Pathway tiles uprooted"],
  General: ["Notice board damaged", "Lost and found request", "Signboard missing", "Water dispenser empty", "Clock not working"],
};
const PLACES = [
  "Block A, Room 101", "Block A, Room 204", "Block B, Room 12", "Block B corridor", "Block C, Room 305", "Block D washroom",
  "Block E, Room 2", "Central library reading room", "Library 2nd floor", "Lab 204", "Physics lab", "Computer lab 3",
  "Canteen", "Cafeteria seating area", "Boys hostel room 118", "Girls hostel common room", "Sports complex gym",
  "Main gate", "Parking area", "Auditorium stage", "Seminar hall", "Admin office", "Near the big tree",
];
const CATEGORIES = Object.keys(TEMPLATES);

async function main() {
  const probe = await fetch(`http://${FIRESTORE_HOST}/`).catch(() => null);
  if (!probe) {
    console.error(`No Firestore emulator at ${FIRESTORE_HOST}. Start the emulators first.`);
    process.exit(1);
  }
  if (args.reset === "true") {
    await fetch(`http://${FIRESTORE_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
    console.log("Emulator Firestore cleared.");
  }

  const now = Date.now();
  const H = 3_600_000;
  const D = 24 * H;

  // Accounts
  const adminId = await account("admin@unifix.test", "Demo Admin");
  const workers = [];
  for (let i = 1; i <= 3; i++) workers.push({ id: await account(`worker${i}@unifix.test`, `Demo Worker ${i}`), name: `Demo Worker ${i}` });
  const students = [];
  for (let i = 1; i <= 5; i++) students.push({ id: await account(`student${i}@unifix.test`, `Demo Student ${i}`), name: `Demo Student ${i}` });

  const created = new Date(now - 200 * D);
  put(`users/${adminId}`, { id: adminId, name: "Demo Admin", email: "admin@unifix.test", role: "user", roles: ["user"], activeRole: "admin", createdAt: created });
  put(`admins/${adminId}`, { grantedAt: created });
  for (const [i, w] of workers.entries()) {
    put(`users/${w.id}`, { id: w.id, name: w.name, email: `worker${i + 1}@unifix.test`, role: "worker", roles: ["user", "worker"], activeRole: "worker", workerRequest: "approved", earnings: 0, createdAt: created });
  }
  for (const [i, s] of students.entries()) {
    put(`users/${s.id}`, { id: s.id, name: s.name, email: `student${i + 1}@unifix.test`, role: "user", roles: ["user"], activeRole: "user", createdAt: created });
  }
  put("finance/budget", { totalAvailable: 500000, totalSpent: 0, updatedAt: new Date(now) });
  const locations = [
    { id: "labs-physics-lab-204", name: "Physics Lab", buildingId: "labs", floor: "2", room: "204" },
    { id: "library-reading-room", name: "Reading Room", buildingId: "library", floor: "1", room: "" },
    { id: "canteen-main-hall", name: "Main Hall", buildingId: "canteen", floor: "", room: "" },
  ];
  for (const l of locations) put(`campusLocations/${l.id}`, { name: l.name, buildingId: l.buildingId, floor: l.floor, room: l.room, createdAt: created });

  // Issues spread over the last 120 days, newer ones more likely open.
  const issueIds = [];
  for (let n = 0; n < ISSUE_COUNT; n++) {
    const id = `seed${String(n).padStart(5, "0")}${Math.floor(rand() * 1e6).toString(36)}`;
    const category = pick(CATEGORIES);
    const title = pick(TEMPLATES[category]);
    const useQr = rand() < 0.12;
    const loc = useQr ? pick(locations) : null;
    const location = loc ? `${loc.name}, ${loc.room ? `Room ${loc.room}` : loc.buildingId}` : pick(PLACES);
    const ageDays = Math.pow(rand(), 1.6) * 120;
    const createdAt = new Date(now - ageDays * D - rand() * D);
    const priority = category === "Safety" || rand() < 0.15 ? "High" : rand() < 0.5 ? "Medium" : "Low";
    const reporter = pick(students);
    const roll = rand();
    const status = ageDays > 10 ? (roll < 0.85 ? "Resolved" : roll < 0.93 ? "In Progress" : "Open") : roll < 0.4 ? "Resolved" : roll < 0.7 ? "In Progress" : "Open";
    const worker = status === "Open" && rand() < 0.6 ? null : pick(workers);
    const startedAt = status !== "Open" ? new Date(createdAt.getTime() + (0.5 + rand() * 6) * H) : undefined;
    const resolveHours = priority === "High" ? 2 + rand() * 10 : priority === "Medium" ? 6 + rand() * 40 : 12 + rand() * 100;
    const resolvedAt = status === "Resolved" ? new Date(Math.min(now - H, createdAt.getTime() + resolveHours * H)) : undefined;
    const duplicateOf = n > 10 && rand() < 0.04 ? pick(issueIds.slice(-30)) : undefined;

    put(`issues/${id}`, {
      title: `${title}${rand() < 0.5 ? ` in ${location.split(",")[0]}` : ""}`,
      description: `${title}. Reported at ${location}. Please check.`,
      location,
      category,
      priority,
      status,
      createdBy: reporter.id,
      createdByName: reporter.name,
      assignedTo: worker?.id ?? "",
      createdAt,
      updatedAt: resolvedAt ?? startedAt ?? createdAt,
      startedAt,
      resolvedAt,
      upvotes: 0,
      upvotedBy: [],
      escalated: false,
      imageUrl: "",
      imageUrls: [],
      thumbnails: [],
      imageCount: 0,
      aiConfidence: Math.round((0.5 + rand() * 0.4) * 100) / 100,
      aiDepartment: DEPARTMENTS[category],
      locationId: loc?.id,
      duplicateOf,
    });
    put(`issues/${id}/events/reported`, { type: "reported", actorRole: "user", category, priority, createdAt });
    if (startedAt) put(`issues/${id}/events/started`, { type: "started", actorRole: "worker", createdAt: startedAt });
    if (resolvedAt) put(`issues/${id}/events/resolved`, { type: "resolved", actorRole: "worker", createdAt: resolvedAt });
    if (resolvedAt && worker && rand() < 0.45) {
      const rating = Math.max(1, Math.min(5, Math.round(3.8 + (rand() - 0.5) * 3)));
      const ratedAt = new Date(Math.min(now, resolvedAt.getTime() + rand() * 2 * D));
      put(`feedback/${id}`, { issueId: id, rating, comment: "", createdBy: reporter.id, assignedTo: worker.id, category, createdAt: ratedAt });
      put(`issues/${id}/events/feedback`, { type: "feedback", actorRole: "user", rating, createdAt: ratedAt });
    }
    issueIds.push(id);
    if (writes.length >= 2000) await flush();
  }
  await flush();
  console.log(`Seeded ${ISSUE_COUNT} issues, 1 admin, ${workers.length} workers, ${students.length} students, ${locations.length} QR locations into ${PROJECT} (emulator).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
