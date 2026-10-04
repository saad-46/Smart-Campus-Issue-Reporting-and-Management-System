// Viewer navigation: public sections only. There is deliberately no entry
// for an account, payments, notifications, worker access or settings.

export type ViewerIcon = "overview" | "student" | "worker" | "admin" | "map" | "analytics" | "how";

export interface ViewerNavItem {
  href: string;
  label: string;
  icon: ViewerIcon;
}

export const VIEWER_PERSPECTIVES: (ViewerNavItem & { summary: string })[] = [
  { href: "/viewer/student", label: "Student", icon: "student", summary: "Report and track campus issues." },
  { href: "/viewer/worker", label: "Worker", icon: "worker", summary: "Manage assigned maintenance work." },
  { href: "/viewer/admin", label: "Admin", icon: "admin", summary: "Monitor campus operations and performance." },
];

export const VIEWER_NAV: { label: string; items: ViewerNavItem[] }[] = [
  { label: "Explore", items: [{ href: "/viewer", label: "Overview", icon: "overview" }] },
  { label: "Perspectives", items: VIEWER_PERSPECTIVES },
  {
    label: "Tools",
    items: [
      { href: "/viewer/map", label: "Campus map", icon: "map" },
      { href: "/viewer/analytics", label: "Analytics", icon: "analytics" },
      { href: "/viewer/how-it-works", label: "How it works", icon: "how" },
    ],
  },
];

export function isViewerPathActive(href: string, pathname: string): boolean {
  return href === "/viewer" ? pathname === "/viewer" : pathname === href || pathname.startsWith(`${href}/`);
}
