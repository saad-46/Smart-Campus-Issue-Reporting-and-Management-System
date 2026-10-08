import React from "react";
import {
  BarChart3,
  ClipboardList,
  Globe2,
  HardHat,
  LayoutDashboard,
  ListChecks,
  Map,
  MapPin,
  PlusCircle,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { UserRole } from "@/types";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Extra paths that should mark this item active. */
  match?: (pathname: string, tab: string | null) => boolean;
  /** Guided-tour anchor (Viewer Mode). */
  tour?: string;
  /** Small count shown at the end of the row (e.g. unread notifications). */
  count?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Navigation per role. Kept short and grouped; every item is a real page. */
export function navForRole(role: UserRole): NavGroup[] {
  if (role === "admin") {
    return [
      {
        label: "Operations",
        items: [
          { label: "Overview", href: "/admin", icon: <LayoutDashboard />, match: (p) => p === "/admin" },
          { label: "Issues", href: "/admin/issues", icon: <ListChecks /> },
          { label: "Analytics", href: "/admin/analytics", icon: <BarChart3 /> },
          { label: "Campus map", href: "/admin/map", icon: <Map /> },
        ],
      },
      {
        label: "Management",
        items: [
          { label: "Workers", href: "/admin/workers", icon: <Users /> },
          { label: "Finance", href: "/admin/finance", icon: <Wallet /> },
        ],
      },
      {
        label: "Configuration",
        items: [
          { label: "Locations & QR", href: "/admin/locations", icon: <MapPin /> },
          { label: "Settings", href: "/admin/settings", icon: <Settings /> },
        ],
      },
    ];
  }
  if (role === "worker") {
    return [
      {
        label: "Work",
        items: [
          { label: "My work", href: "/worker", icon: <HardHat /> },
          { label: "Report an issue", href: "/dashboard/report", icon: <PlusCircle /> },
          { label: "Search", href: "/search", icon: <Search /> },
        ],
      },
    ];
  }
  return [
    {
      label: "Campus",
      items: [
        {
          label: "My issues",
          href: "/dashboard",
          icon: <ClipboardList />,
          match: (p, tab) => p === "/dashboard" && tab !== "explore",
        },
        {
          label: "Community",
          href: "/dashboard?tab=explore",
          icon: <Globe2 />,
          match: (p, tab) => p === "/dashboard" && tab === "explore",
        },
        { label: "Report an issue", href: "/dashboard/report", icon: <PlusCircle /> },
        { label: "Search", href: "/search", icon: <Search /> },
      ],
    },
  ];
}

export function isActive(item: NavItem, pathname: string, tab: string | null): boolean {
  if (item.match) return item.match(pathname, tab);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export const ROLE_LABELS: Record<UserRole, string> = { user: "Student", worker: "Worker", admin: "Admin" };
