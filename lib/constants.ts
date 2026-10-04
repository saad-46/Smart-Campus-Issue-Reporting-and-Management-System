// ============================================
// Shared constants — single source of truth
// ============================================
// Keep these in sync with firestore.rules: the rules enforce the same
// enums and size limits server-side.

import { IssueStatus, Priority, UserRole } from "@/types";

export const USER_ROLES: UserRole[] = ["user", "worker", "admin"];

/**
 * Roles a person may select on the registration form. Selecting "worker"
 * only files a request: the account is created as a plain user and an
 * admin has to approve it. Admin can never be selected.
 */
export const SELF_ASSIGNABLE_ROLES: UserRole[] = ["user", "worker"];

export const ISSUE_STATUSES: IssueStatus[] = ["Open", "In Progress", "Resolved"];

export const PRIORITIES: Priority[] = ["Low", "Medium", "High"];

export const ISSUE_CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Infrastructure",
  "Cleanliness",
  "Safety",
  "IT",
  "Furniture",
  "Landscaping",
  "General",
] as const;

export const DEFAULT_CATEGORY = "General";

/** Team that normally handles each category (the AI's department suggestion). */
export const CATEGORY_DEPARTMENTS: Record<string, string> = {
  Electrical: "Electrical Maintenance",
  Plumbing: "Plumbing & Water",
  Infrastructure: "Civil & Estates",
  Cleanliness: "Housekeeping",
  Safety: "Campus Security",
  IT: "IT Services",
  Furniture: "Facilities & Furniture",
  Landscaping: "Grounds & Gardens",
  General: "Facilities Helpdesk",
};

/** Mirrors the department enum in firestore.rules. */
export const DEPARTMENTS = Object.values(CATEGORY_DEPARTMENTS);

export function departmentFor(category: string): string {
  return CATEGORY_DEPARTMENTS[category] ?? CATEGORY_DEPARTMENTS.General;
}

/**
 * Default resolution targets (hours) per priority. Admins can override
 * them (stored in config/sla); these apply until they do.
 */
export const DEFAULT_SLA_HOURS: Record<Priority, number> = {
  High: 6,
  Medium: 24,
  Low: 72,
};

/** Share of the SLA window after which an issue counts as "approaching". */
export const SLA_WARNING_FRACTION = 0.75;

export const SLA_HOURS_MIN = 1;
export const SLA_HOURS_MAX = 2160; // 90 days

/** Caps on the projection queries used by analytics, search and the map. */
export const QUERY_LIMITS = {
  analytics: 2000,
  search: 1000,
  duplicates: 300,
  feedback: 500,
  notifications: 50,
} as const;
export const DEFAULT_PRIORITY: Priority = "Low";

/** Issue lifecycle: strictly forward, one step at a time. */
export const STATUS_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  Open: ["In Progress"],
  "In Progress": ["Resolved"],
  Resolved: [],
};

export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Upvotes needed before an issue is auto-promoted to High priority. */
export const UPVOTE_PRIORITY_THRESHOLD = 5;

export const LIMITS = {
  name: 80,
  title: 150,
  description: 5000,
  location: 200,
  chatMessage: 2000,
  passwordMin: 8,
  maxImages: 3,
  /** Max size of a file the user may pick before compression. */
  uploadMb: 5,
  /** Max length of a stored base64 data URL. Each full-size image is its
   *  own Firestore document (1 MiB cap); the issue document itself only
   *  carries small thumbnails so list queries stay light. */
  imageChars: 220_000,
  thumbChars: 24_000,
  receiptChars: 250_000,
  /** Minimum seconds between issues from one account (enforced in firestore.rules). */
  issueCooldownSeconds: 30,
  maxClaimAmount: 1_000_000,
  /** "What was it spent on?" on an expense claim (enforced in firestore.rules). */
  claimDescription: 500,
  maxFundsAmount: 100_000_000,
} as const;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
