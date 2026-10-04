// ============================================
// Runtime normalisation of Firestore documents
// ============================================
// TypeScript interfaces don't validate what actually comes out of the
// database. These functions turn an arbitrary document (missing fields,
// wrong types, legacy shapes) into a well-formed object so the UI can't
// crash on bad data.

import {
  AppNotification,
  Budget,
  CampusLocation,
  ChatMessage,
  Feedback,
  Issue,
  IssueEvent,
  IssueEventType,
  IssueStatus,
  IssueSummary,
  NotificationType,
  Priority,
  Transaction,
  User,
  UserRole,
  WorkerRequestStatus,
} from "@/types";
import { DEFAULT_CATEGORY, ISSUE_STATUSES, PRIORITIES, USER_ROLES } from "./constants";
import { toDate, toDateOr } from "./dates";
import { isDisplayableImageUrl } from "./validation";

type Doc = Record<string, unknown>;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function role(value: unknown, fallback: UserRole = "user"): UserRole {
  return USER_ROLES.includes(value as UserRole) ? (value as UserRole) : fallback;
}

export function normalizeIssue(id: string, data: Doc | undefined | null): Issue {
  const d = data ?? {};
  const epoch = new Date(0);
  const createdAt = toDateOr(d.createdAt, epoch);

  // Legacy issues keep full images inside the document; newer ones keep
  // thumbnails here and the full images in a subcollection.
  const imageUrls = stringArray(d.imageUrls).filter(isDisplayableImageUrl);
  const legacyImage = str(d.imageUrl);
  if (imageUrls.length === 0 && isDisplayableImageUrl(legacyImage)) imageUrls.push(legacyImage);
  const storedThumbnails = stringArray(d.thumbnails).filter(isDisplayableImageUrl);
  const hasImageDocs = storedThumbnails.length > 0;
  const thumbnails = hasImageDocs ? storedThumbnails : imageUrls;

  const claimStatus = ["pending", "approved", "rejected"].includes(d.claimStatus as string)
    ? (d.claimStatus as Issue["claimStatus"])
    : undefined;
  const receiptUrl = str(d.receiptUrl);
  const upvotedBy = stringArray(d.upvotedBy);

  return {
    id,
    title: str(d.title) || "Untitled issue",
    description: str(d.description),
    category: str(d.category) || DEFAULT_CATEGORY,
    priority: PRIORITIES.includes(d.priority as Priority) ? (d.priority as Priority) : "Low",
    status: ISSUE_STATUSES.includes(d.status as IssueStatus) ? (d.status as IssueStatus) : "Open",
    location: str(d.location) || "Unknown",
    createdBy: str(d.createdBy),
    createdByName: str(d.createdByName) || "Unknown",
    assignedTo: str(d.assignedTo),
    createdAt,
    updatedAt: toDateOr(d.updatedAt, createdAt),
    startedAt: toDate(d.startedAt),
    resolvedAt: toDate(d.resolvedAt),
    upvotes: Math.max(0, num(d.upvotes, upvotedBy.length)),
    upvotedBy,
    escalated: d.escalated === true,
    imageUrl: imageUrls[0] ?? "",
    imageUrls,
    thumbnails,
    imageCount: thumbnails.length,
    hasImageDocs,
    claimAmount: Math.max(0, num(d.claimAmount)),
    claimDescription: str(d.claimDescription),
    claimStatus,
    receiptUrl: isDisplayableImageUrl(receiptUrl) ? receiptUrl : "",
    hasReceipt: d.hasReceipt === true || isDisplayableImageUrl(receiptUrl),
    aiSummary: str(d.aiSummary),
    aiConfidence: confidence(d.aiConfidence),
    aiDepartment: str(d.aiDepartment),
    locationId: str(d.locationId),
    duplicateOf: d.duplicateOf !== id ? str(d.duplicateOf) : "",
  };
}

function confidence(value: unknown): number | null {
  return typeof value === "number" && value >= 0 && value <= 1 ? value : null;
}

function priority(value: unknown): Priority {
  return PRIORITIES.includes(value as Priority) ? (value as Priority) : "Low";
}

function status(value: unknown): IssueStatus {
  return ISSUE_STATUSES.includes(value as IssueStatus) ? (value as IssueStatus) : "Open";
}

/** The lightweight projection used by analytics, the map, search and duplicate checks. */
export function normalizeIssueSummary(id: string, data: Doc | undefined | null): IssueSummary {
  const d = data ?? {};
  const createdAt = toDateOr(d.createdAt, new Date(0));
  return {
    id,
    title: str(d.title) || "Untitled issue",
    category: str(d.category) || DEFAULT_CATEGORY,
    priority: priority(d.priority),
    status: status(d.status),
    location: str(d.location) || "Unknown",
    locationId: str(d.locationId),
    assignedTo: str(d.assignedTo),
    duplicateOf: d.duplicateOf !== id ? str(d.duplicateOf) : "",
    createdAt,
    startedAt: toDate(d.startedAt),
    resolvedAt: toDate(d.resolvedAt),
    escalated: d.escalated === true,
  };
}

export function toIssueSummary(issue: Issue): IssueSummary {
  const { id, title, category, priority: p, status: s, location, locationId, assignedTo, duplicateOf, createdAt, startedAt, resolvedAt } = issue;
  return {
    id, title, category, priority: p, status: s, location, locationId, assignedTo, duplicateOf, createdAt, startedAt, resolvedAt,
    escalated: issue.escalated === true,
  };
}

const EVENT_TYPES: IssueEventType[] = [
  "reported", "claimed", "assigned", "started", "resolved", "claim_approved", "claim_rejected", "linked", "feedback",
];

export function normalizeIssueEvent(id: string, data: Doc | undefined | null): IssueEvent | null {
  const d = data ?? {};
  if (!EVENT_TYPES.includes(d.type as IssueEventType)) return null;
  return {
    id,
    type: d.type as IssueEventType,
    actorRole: role(d.actorRole),
    createdAt: toDateOr(d.createdAt, new Date()),
    category: typeof d.category === "string" ? d.category : undefined,
    priority: PRIORITIES.includes(d.priority as Priority) ? (d.priority as Priority) : undefined,
    confidence: confidence(d.confidence),
    duplicateOf: typeof d.duplicateOf === "string" ? d.duplicateOf : undefined,
    rating: typeof d.rating === "number" ? d.rating : undefined,
  };
}

const NOTIFICATION_TYPES: NotificationType[] = ["issue_assigned", "status_changed", "worker_access", "claim_decision"];

export function normalizeNotification(id: string, data: Doc | undefined | null): AppNotification | null {
  const d = data ?? {};
  if (!NOTIFICATION_TYPES.includes(d.type as NotificationType)) return null;
  return {
    id,
    type: d.type as NotificationType,
    recipientId: str(d.recipientId),
    issueId: str(d.issueId),
    issueTitle: str(d.issueTitle),
    status: ISSUE_STATUSES.includes(d.status as IssueStatus) ? (d.status as IssueStatus) : undefined,
    decision: d.decision === "approved" || d.decision === "rejected" ? d.decision : undefined,
    amount: typeof d.amount === "number" && Number.isFinite(d.amount) ? d.amount : undefined,
    createdAt: toDateOr(d.createdAt, new Date()),
    readAt: toDate(d.readAt) ?? null,
  };
}

export function normalizeFeedback(id: string, data: Doc | undefined | null): Feedback | null {
  const d = data ?? {};
  const rating = num(d.rating, NaN);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null;
  return {
    issueId: str(d.issueId) || id,
    rating,
    comment: str(d.comment),
    createdBy: str(d.createdBy),
    assignedTo: str(d.assignedTo),
    category: str(d.category) || DEFAULT_CATEGORY,
    createdAt: toDateOr(d.createdAt, new Date()),
  };
}

export function normalizeCampusLocation(id: string, data: Doc | undefined | null): CampusLocation {
  const d = data ?? {};
  return {
    id,
    name: str(d.name) || id,
    buildingId: str(d.buildingId),
    floor: str(d.floor),
    room: str(d.room),
    createdAt: toDateOr(d.createdAt, new Date(0)),
  };
}

export function normalizeUser(id: string, data: Doc | undefined | null): User {
  const d = data ?? {};
  const baseRole = role(d.role);
  return {
    id,
    name: str(d.name) || "Unnamed user",
    email: str(d.email),
    role: baseRole,
    activeRole: role(d.activeRole, baseRole),
    createdAt: toDateOr(d.createdAt, new Date(0)),
    earnings: Math.max(0, num(d.earnings)),
    workerRequest: ["pending", "approved", "rejected"].includes(d.workerRequest as string)
      ? (d.workerRequest as WorkerRequestStatus)
      : undefined,
  };
}

export function normalizeChatMessage(id: string, data: Doc | undefined | null): ChatMessage {
  const d = data ?? {};
  return {
    id,
    text: str(d.text),
    authorId: str(d.authorId),
    authorName: str(d.authorName) || "Unknown",
    authorRole: role(d.authorRole),
    createdAt: toDateOr(d.createdAt, new Date()),
  };
}

export function normalizeBudget(id: string, data: Doc | undefined | null): Budget {
  const d = data ?? {};
  return {
    id,
    totalAvailable: Math.max(0, num(d.totalAvailable)),
    totalSpent: Math.max(0, num(d.totalSpent)),
    updatedAt: toDateOr(d.updatedAt, new Date(0)),
  };
}

export function normalizeTransaction(id: string, data: Doc | undefined | null): Transaction {
  const d = data ?? {};
  return {
    id,
    workerId: str(d.workerId),
    workerName: str(d.workerName) || "Unknown",
    amount: Math.max(0, num(d.amount)),
    type: d.type === "direct" ? "direct" : "receipt",
    issueId: str(d.issueId),
    note: str(d.note),
    status: ["pending", "approved", "rejected"].includes(d.status as string)
      ? (d.status as Transaction["status"])
      : "approved",
    receiptUrl: str(d.receiptUrl),
    createdAt: toDateOr(d.createdAt, new Date()),
  };
}
