// ============================================
// Error handling
// ============================================
// Maps Firebase / validation errors to messages that are safe to show a
// user. Raw Firebase messages, codes and stack traces never reach the UI.

/** Thrown for bad input. Its message is written for end users. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const MESSAGES: Record<string, string> = {
  // Auth
  "auth/invalid-credential": "Invalid email or password.",
  "auth/user-not-found": "Invalid email or password.",
  "auth/wrong-password": "Invalid email or password.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This account has been disabled. Please contact an administrator.",
  "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
  "auth/email-already-in-use": "This email is already registered. Please sign in instead.",
  "auth/weak-password": "That password is too weak. Please choose a stronger one.",
  "auth/network-request-failed": "Network error. Please check your connection and try again.",
  "auth/requires-recent-login": "Please sign in again to continue.",
  "auth/user-token-expired": "Your session has expired. Please sign in again.",
  // Firestore
  "permission-denied": "You don't have permission to do that.",
  unauthenticated: "Your session has expired. Please sign in again.",
  unavailable: "The service is unreachable right now. Please check your connection and try again.",
  "deadline-exceeded": "The request timed out. Please try again.",
  "not-found": "That item no longer exists.",
  "already-exists": "That item already exists.",
  "resource-exhausted": "The service is busy right now. Please try again shortly.",
  "failed-precondition": "That action isn't possible right now. Please refresh and try again.",
  aborted: "Someone else changed this at the same time. Please try again.",
  cancelled: "The request was cancelled. Please try again.",
};

export function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Turn any thrown value into a message that is safe to display.
 * @param fallback shown when the error isn't one we recognise
 */
export function getFriendlyErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again."
): string {
  if (error instanceof ValidationError) return error.message;

  const code = getErrorCode(error);
  if (code && MESSAGES[code]) return MESSAGES[code];

  return fallback;
}

/**
 * Log an error for diagnostics without leaking user data: only the
 * operation name and the error code/name are recorded.
 */
export function logError(operation: string, error: unknown): void {
  const code = getErrorCode(error);
  const name = error instanceof Error ? error.name : typeof error;
  console.error(`[${operation}] failed`, { code: code ?? "unknown", name });
}

/**
 * Fail fast when the browser knows it is offline. Firestore would otherwise
 * queue the write and leave the UI waiting with no feedback.
 */
export function assertOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new ValidationError("You appear to be offline. Please reconnect and try again.");
  }
}
