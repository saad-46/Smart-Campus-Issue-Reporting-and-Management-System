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
  imageUrls?: string[];    // NEW: Array of images
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  resolvedAt?: Date;
  upvotes: number;
  upvotedBy: string[]; // user IDs who upvoted
  escalated?: boolean; // true if escalated by engine
  receiptUrl?: string; // Uploaded expense receipt
  claimAmount?: number; // Cost of repair claimed by worker
  claimStatus?: "pending" | "approved" | "rejected"; // Status of the receipt
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
  createdAt: Date;
}

