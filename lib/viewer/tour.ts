// The guided tour. Every step names the page it belongs to, the perspective
// that page needs and the `data-tour` anchor it highlights. A unit test
// checks that each anchor exists in the source of the matching page or
// shell, so a step can never point at something that isn't there. When an
// anchor isn't visible (for example the sidebar on a phone) the step is
// shown without a highlight rather than pointing at nothing.

import type { ViewerRole } from "./guide";

export interface TourStep {
  id: string;
  title: string;
  body: string;
  role?: ViewerRole;
  /** Page to open first. */
  path: string;
  /** data-tour anchor to highlight; omitted for centred steps. */
  target?: string;
  /** Where to learn more. */
  learnMore?: { label: string; href: string };
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to the UniFix demo",
    body: "This is the full product running on invented campus data. Nothing you do here is saved, and no account is needed. The next few minutes show how an issue travels from report to resolution.",
    role: "admin",
    path: "/viewer",
  },
  {
    id: "shell",
    title: "One workspace for every role",
    body: "The sidebar lists exactly what this role can open in the real app. Collapse it to icons with the button at its foot; your choice is remembered on this browser.",
    role: "admin",
    path: "/viewer/admin",
    target: "sidebar",
  },
  {
    id: "roles",
    title: "Switch perspectives",
    body: "Student, Worker and Admin see different menus, figures and actions. Switch at any time. Nothing is reloaded and no data carries over between them.",
    role: "admin",
    path: "/viewer/admin",
    target: "role-switcher",
  },
  {
    id: "student",
    title: "A student's dashboard",
    body: "Students see their own reports with live status and a deadline on each. Resolved issues invite a rating.",
    role: "student",
    path: "/viewer/student",
    target: "student-kpis",
  },
  {
    id: "report",
    title: "Reporting an issue",
    body: "Describe the problem, pick the place and optionally add a photo. Submitting here only adds a sample report to this visit.",
    role: "student",
    path: "/viewer/report",
    target: "report-form",
  },
  {
    id: "intelligence",
    title: "Suggestions and duplicate detection",
    body: "While you type, the system suggests a category, priority and team, with the reason, and lists similar open reports so the same fault isn't reported twice. It is rule-based, not a language model, and people can change the result.",
    role: "student",
    path: "/viewer/report",
    target: "report-ai",
  },
  {
    id: "issues",
    title: "Issue management",
    body: "Search, filter, sort and page through every report. Each row shows its priority, status and deadline state.",
    role: "admin",
    path: "/viewer/issues",
    target: "issues-table",
  },
  {
    id: "sla",
    title: "Deadlines (SLA)",
    body: "Each priority has a target time. The state is computed from the timestamps, so it can never be faked, and it turns amber when time is short and red when it is missed.",
    role: "admin",
    path: "/viewer/issues/SC-1136",
    target: "issue-sla",
  },
  {
    id: "assign",
    title: "Assigning the right worker",
    body: "Administrators get ranked suggestions based on experience in the category, current workload and ratings, with the reason for each. Try the demo assignment.",
    role: "admin",
    path: "/viewer/issues/SC-1133",
    target: "issue-assign",
  },
  {
    id: "timeline",
    title: "A timeline for every issue",
    body: "Every step is recorded: reported, assigned, started, resolved, claim decisions and feedback. It is the audit trail behind the figures.",
    role: "admin",
    path: "/viewer/issues/SC-1121",
    target: "issue-timeline",
  },
  {
    id: "worker",
    title: "A worker's queue",
    body: "Workers see their assigned tasks, most urgent first, plus open issues they can pick up. Starting and resolving work moves the issue forward.",
    role: "worker",
    path: "/viewer/worker",
    target: "worker-queue",
  },
  {
    id: "claims",
    title: "Expense claims",
    body: "After resolving, a worker can claim what was spent with the amount, what it was for and a receipt. An administrator reviews it, and it is paid exactly once.",
    role: "worker",
    path: "/viewer/worker",
    target: "worker-claims",
  },
  {
    id: "admin",
    title: "The operations overview",
    body: "Administrators see open work, overdue items, compliance and the week's trend at a glance. Every number is computed from the sample data.",
    role: "admin",
    path: "/viewer/admin",
    target: "admin-kpis",
  },
  {
    id: "incidents",
    title: "Incidents",
    body: "Several reports of the same fault are linked into one incident, so it is fixed once instead of five times. Nothing is merged or deleted.",
    role: "admin",
    path: "/viewer/admin",
    target: "admin-incidents",
  },
  {
    id: "analytics",
    title: "Analytics",
    body: "Trends, categories, deadline performance, department results and when problems get reported. Filter by date range and category; every chart responds.",
    role: "admin",
    path: "/viewer/analytics",
    target: "analytics-filters",
  },
  {
    id: "map",
    title: "Campus map",
    body: "Switch layers to see issue density, active incidents, maintenance risk or deadline hotspots by building. Select a building for its detail.",
    role: "admin",
    path: "/viewer/map",
    target: "map-layers",
  },
  {
    id: "finance",
    title: "Finance",
    body: "Budget, spending, pending claims and the payment ledger. Paying here is a demo and creates no real transaction.",
    role: "admin",
    path: "/viewer/finance",
    target: "finance-summary",
  },
  {
    id: "workers",
    title: "Workers",
    body: "Workload, resolution time, ratings and earnings per worker, plus requests for worker access that only an administrator can approve.",
    role: "admin",
    path: "/viewer/workers",
    target: "workers-table",
  },
  {
    id: "qr",
    title: "Locations and QR reporting",
    body: "Each place can have a QR code. Scanning it opens the report form with the location already filled in. Open one to see and print its code.",
    role: "admin",
    path: "/viewer/locations",
    target: "locations-list",
  },
  {
    id: "settings",
    title: "Settings",
    body: "Deadline targets per priority are configured here. Change them and every deadline and compliance figure recalculates.",
    role: "admin",
    path: "/viewer/settings",
    target: "settings-sla",
  },
  {
    id: "notifications",
    title: "Notifications",
    body: "People are told when work is assigned, started or resolved, and when a claim is decided. Unread items are marked until you open them.",
    role: "admin",
    path: "/viewer/notifications",
    target: "notifications-bell",
  },
  {
    id: "search",
    title: "Search everything",
    body: "Press Ctrl K (⌘K on Mac) anywhere to find issues, locations, workers, students and pages, and move through results with the arrow keys.",
    role: "admin",
    path: "/viewer/search",
    target: "search-button",
  },
  {
    id: "theme",
    title: "Light and dark",
    body: "Both themes are designed, not inverted. Your choice is remembered on this browser and applies to the whole product.",
    role: "admin",
    path: "/viewer/admin",
    target: "theme-toggle",
  },
  {
    id: "done",
    title: "That's the product",
    body: "Reopen this guide from the Guide button any time. Sign in to work with real campus data, or keep exploring the demo.",
    role: "admin",
    path: "/viewer",
    learnMore: { label: "How the lifecycle works", href: "/viewer/how-it-works" },
  },
];
