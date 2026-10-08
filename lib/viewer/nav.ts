// Viewer navigation: one menu per perspective, mirroring the signed-in app
// (components/shell/nav.tsx) plus the shared activity pages. Every entry is
// a public /viewer page; there is deliberately no account, payment
// processing or sign-out entry.

import type { ViewerRole } from "./guide";

export type { ViewerRole };

export type ViewerIcon =
  | "overview"
  | "student"
  | "worker"
  | "admin"
  | "issues"
  | "community"
  | "report"
  | "map"
  | "analytics"
  | "workers"
  | "finance"
  | "locations"
  | "settings"
  | "notifications"
  | "search"
  | "timeline"
  | "how";

export interface ViewerNavItem {
  href: string;
  label: string;
  icon: ViewerIcon;
  /** Guided-tour anchor. */
  tour?: string;
}

export interface ViewerNavGroup {
  label: string;
  items: ViewerNavItem[];
}

export const VIEWER_ROLES: ViewerRole[] = ["student", "worker", "admin"];

export const VIEWER_PERSPECTIVES: (ViewerNavItem & { role: ViewerRole; summary: string; noun: string })[] = [
  { role: "student", href: "/viewer/student", label: "Student", noun: "student", icon: "student", summary: "Report problems, follow their progress and rate the fix." },
  { role: "worker", href: "/viewer/worker", label: "Worker", noun: "maintenance worker", icon: "worker", summary: "Work through assigned tasks, resolve them and claim expenses." },
  { role: "admin", href: "/viewer/admin", label: "Admin", noun: "administrator", icon: "admin", summary: "Assign work, watch deadlines and read campus-wide analytics." },
];

const ACTIVITY: ViewerNavItem[] = [
  { href: "/viewer/notifications", label: "Notifications", icon: "notifications" },
  { href: "/viewer/search", label: "Search", icon: "search" },
  { href: "/viewer/timeline", label: "Timeline", icon: "timeline" },
];

const HELP: ViewerNavGroup = { label: "Help", items: [{ href: "/viewer/how-it-works", label: "How it works", icon: "how" }] };

export function navForViewerRole(role: ViewerRole): ViewerNavGroup[] {
  if (role === "admin") {
    return [
      {
        label: "Operations",
        items: [
          { href: "/viewer/admin", label: "Overview", icon: "overview", tour: "nav-overview" },
          { href: "/viewer/issues", label: "Issues", icon: "issues", tour: "nav-issues" },
          { href: "/viewer/analytics", label: "Analytics", icon: "analytics", tour: "nav-analytics" },
          { href: "/viewer/map", label: "Campus map", icon: "map", tour: "nav-map" },
        ],
      },
      {
        label: "Management",
        items: [
          { href: "/viewer/workers", label: "Workers", icon: "workers", tour: "nav-workers" },
          { href: "/viewer/finance", label: "Finance", icon: "finance", tour: "nav-finance" },
        ],
      },
      {
        label: "Configuration",
        items: [
          { href: "/viewer/locations", label: "Locations & QR", icon: "locations", tour: "nav-locations" },
          { href: "/viewer/settings", label: "Settings", icon: "settings", tour: "nav-settings" },
        ],
      },
      { label: "Activity", items: ACTIVITY },
      HELP,
    ];
  }
  if (role === "worker") {
    return [
      {
        label: "Work",
        items: [
          { href: "/viewer/worker", label: "My work", icon: "worker", tour: "nav-overview" },
          { href: "/viewer/issues", label: "All issues", icon: "issues", tour: "nav-issues" },
          { href: "/viewer/report", label: "Report an issue", icon: "report", tour: "nav-report" },
        ],
      },
      { label: "Activity", items: ACTIVITY },
      HELP,
    ];
  }
  return [
    {
      label: "Campus",
      items: [
        { href: "/viewer/student", label: "My issues", icon: "student", tour: "nav-overview" },
        { href: "/viewer/issues", label: "Community", icon: "community", tour: "nav-issues" },
        { href: "/viewer/report", label: "Report an issue", icon: "report", tour: "nav-report" },
      ],
    },
    { label: "Activity", items: ACTIVITY },
    HELP,
  ];
}

/**
 * Which perspectives may open a page. Pages open to everyone are not listed;
 * deep links to a role-specific page switch to that role (the way a real
 * account would have had to be that role).
 */
const ROLE_PAGES: { prefix: string; roles: ViewerRole[] }[] = [
  { prefix: "/viewer/student", roles: ["student"] },
  { prefix: "/viewer/worker", roles: ["worker"] },
  { prefix: "/viewer/admin", roles: ["admin"] },
  { prefix: "/viewer/analytics", roles: ["admin"] },
  { prefix: "/viewer/map", roles: ["admin"] },
  { prefix: "/viewer/workers", roles: ["admin"] },
  { prefix: "/viewer/finance", roles: ["admin"] },
  { prefix: "/viewer/locations", roles: ["admin"] },
  { prefix: "/viewer/settings", roles: ["admin"] },
  { prefix: "/viewer/report", roles: ["student", "worker"] },
];

/** The perspective a page needs, or null when any perspective can open it. */
export function requiredRoles(pathname: string): ViewerRole[] | null {
  const hit = ROLE_PAGES.find((p) => pathname === p.prefix || pathname.startsWith(`${p.prefix}/`));
  return hit ? hit.roles : null;
}

export function roleForPath(pathname: string, current: ViewerRole): ViewerRole {
  const needed = requiredRoles(pathname);
  return !needed || needed.includes(current) ? current : needed[0];
}

export function homeForRole(role: ViewerRole): string {
  return VIEWER_PERSPECTIVES.find((p) => p.role === role)!.href;
}

export const VIEWER_ROLE_LABELS: Record<ViewerRole, string> = { student: "Student", worker: "Worker", admin: "Admin" };

export function isViewerPathActive(href: string, pathname: string): boolean {
  if (href === "/viewer") return pathname === "/viewer";
  if (href === "/viewer/issues") return pathname === href || pathname.startsWith(`${href}/`);
  return pathname === href || pathname.startsWith(`${href}/`);
}
