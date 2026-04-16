// ============================================
// Core TypeScript interfaces for the application
// ============================================

/** User roles in the system */
export type UserRole = "user" | "admin";

/** Issue priority levels */
export type Priority = "Low" | "Medium" | "High";

/** Issue status lifecycle */
export type IssueStatus = "Open" | "In Progress" | "Resolved";

/** User profile stored in Firestore */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
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
