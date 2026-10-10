// ============================================
// Core TypeScript interfaces for the application
// ============================================

/** User roles in the system */
export type UserRole = "user" | "admin" | "worker";

/** Issue priority levels */
export type Priority = "Low" | "Medium" | "High";

/** Issue status lifecycle */
export type IssueStatus = "Open" | "In Progress" | "Resolved";

/** User profile stored in Firestore */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole; // legacy role fallback
  roles?: UserRole[];
  activeRole?: UserRole;
  createdAt: Date;
  earnings?: number; // Total money earned by the worker
  /** Set when the account asked for worker access; only an admin can resolve it. */
  workerRequest?: WorkerRequestStatus;
}

export type WorkerRequestStatus = "pending" | "approved" | "rejected";

/** A photo attached to a new issue: the full image plus a small preview. */
export interface IssueImage {
  full: string;
  thumb: string;
}

/** Campus issue report */
export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: IssueStatus;
  location: string;
  createdBy: string;       // User ID
  createdByName: string;   // Display name for convenience
  assignedTo: string;      // Admin User ID (empty if unassigned)
  imageUrl?: string;       // legacy base64 or URL
  imageUrls?: string[];    // legacy: full images stored inside the issue document
  /** Small previews stored in the issue document (for legacy issues: the full images). */
  thumbnails: string[];
  imageCount: number;
  /** True when full-size photos live in the issues/{id}/images subcollection. */
  hasImageDocs: boolean;
  /** True when a receipt photo exists (issues/{id}/receipts/receipt, or legacy receiptUrl). */
  hasReceipt: boolean;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  resolvedAt?: Date;
  upvotes: number;
  upvotedBy: string[]; // user IDs who upvoted
  escalated?: boolean; // true if escalated by engine
  receiptUrl?: string; // legacy: receipt stored inside the issue document
  claimAmount?: number; // Cost of repair claimed by worker
  claimDescription?: string; // What the claim was spent on ("" for claims filed before this field existed)
  claimStatus?: "pending" | "approved" | "rejected"; // Status of the receipt
  /** Extractive summary from the analysis layer ("" when the report was short). */
  aiSummary: string;
  /** Heuristic confidence 0–1 of the automatic category, or null for older issues. */
  aiConfidence: number | null;
  /** Suggested handling team. */
  aiDepartment: string;
  /** campusLocations/{id} when the issue was reported through a location QR code. */
  locationId: string;
  /** Master issue of the incident this report belongs to ("" when standalone). */
  duplicateOf: string;
}

/**
 * Lightweight projection of an issue (no description, photos or votes),
 * used by analytics, the map, search and duplicate detection.
 */
export interface IssueSummary {
  id: string;
  title: string;
  category: string;
  priority: Priority;
  status: IssueStatus;
  location: string;
  locationId: string;
  assignedTo: string;
  duplicateOf: string;
  createdAt: Date;
  startedAt?: Date;
  resolvedAt?: Date;
  /** Flagged for attention by an administrator. */
  escalated?: boolean;
}

export type SlaState = "on-track" | "approaching" | "breached" | "met" | "missed";

export interface SlaConfig {
  /** Target hours from report to resolution, per priority. */
  hours: Record<Priority, number>;
  /** True when these are the built-in defaults (no admin override saved). */
  isDefault: boolean;
}

export interface SlaStatus {
  state: SlaState;
  deadline: Date;
  /** Milliseconds left (negative once breached); 0 for resolved issues. */
  remainingMs: number;
  /** Share of the window used, 0–1+ (capped at 1 for display). */
  elapsedFraction: number;
}

/** Event recorded on an issue's timeline (issues/{id}/events). */
export type IssueEventType =
  | "reported"
  | "claimed"
  | "assigned"
  | "started"
  | "resolved"
  | "claim_approved"
  | "claim_rejected"
  | "linked"
  | "feedback";

export interface IssueEvent {
  id: string;
  type: IssueEventType;
  actorRole: UserRole;
  createdAt: Date;
  /** Category/priority at report time, or the linked master issue, etc. */
  category?: string;
  priority?: Priority;
  confidence?: number | null;
  duplicateOf?: string;
  rating?: number;
}

export type NotificationType =
  | "issue_assigned"
  | "status_changed"
  | "worker_access"
  | "claim_decision";

/**
 * A notification addressed to one user. It carries no free text: the
 * message is rendered from the type and the validated fields, so a sender
 * can't put arbitrary words in front of the recipient.
 */
export interface AppNotification {
  id: string;
  type: NotificationType;
  recipientId: string;
  issueId: string;
  issueTitle: string;
  /** status_changed: the new status. */
  status?: IssueStatus;
  /** worker_access / claim_decision: the outcome. */
  decision?: "approved" | "rejected";
  /** claim_decision: the amount paid. */
  amount?: number;
  createdAt: Date;
  readAt: Date | null;
}

/** Student rating of a resolved issue (feedback/{issueId}). */
export interface Feedback {
  issueId: string;
  rating: number;
  comment: string;
  createdBy: string;
  assignedTo: string;
  category: string;
  createdAt: Date;
}

/** An admin-managed reportable place (campusLocations/{id}), used for QR codes. */
export interface CampusLocation {
  id: string;
  name: string;
  buildingId: string;
  floor: string;
  room: string;
  createdAt: Date;
}

/** Result returned from AI analysis service */
export interface AIAnalysisResult {
  category: string;
  priority: Priority;
}

/** Form data for creating a new issue */
export interface CreateIssueData {
  title: string;
  description: string;
  location: string;
}

/** Chat message attached to an Issue */
export interface ChatMessage {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  createdAt: Date;
}

/** Summary of an issue's private chat (conversations/{issueId}): unread state and preview. */
export interface Conversation {
  issueId: string;
  studentId: string;
  workerId: string;
  lastMessageAt: Date;
  lastSenderId: string;
  lastPreview: string;
  /** When each participant last read the conversation, by user id. */
  readAt: Record<string, Date>;
}

/** Financial Tracker: Budget Source */
export interface Budget {
  id: string;
  totalAvailable: number;
  totalSpent: number;
  updatedAt: Date;
}

/** Financial Tracker: Transactions */
export interface Transaction {
  id: string;
  workerId: string;
  workerName: string;
  amount: number;
  type: "receipt" | "direct";
  issueId?: string;
  note?: string;
  status: "pending" | "approved" | "rejected";
  receiptUrl?: string; // If a receipt was attached
  /** How the payment was made, as stated by the administrator who recorded it. */
  method?: "cash" | "bank_transfer" | "upi" | "cheque" | "other";
  /** Reference number the administrator entered (transaction, UPI or cheque number). */
  reference?: string;
  /** Date the payment was made, yyyy-mm-dd, as stated by the administrator. */
  paidOn?: string;
  /** Always "manual": recorded by an administrator, not confirmed by a bank or gateway. */
  verification?: "manual";
  recordedBy?: string;
  createdAt: Date;
}

/** Immutable record of funds made available to the budget (ledger/{id}). */
export interface LedgerEntry {
  id: string;
  type: "funds_added";
  amount: number;
  source: "management_allocation" | "donation" | "grant" | "budget_transfer" | "other";
  reference: string;
  description: string;
  /** Date the funds were received or allocated, yyyy-mm-dd. */
  receivedOn: string;
  createdBy: string;
  createdAt: Date;
}

