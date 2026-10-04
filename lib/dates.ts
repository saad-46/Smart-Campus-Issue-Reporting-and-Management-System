// ============================================
// Date helpers
// ============================================
// Firestore hands back Timestamps, legacy documents hold ISO strings, and
// pending writes hold null. Everything is funnelled through toDate() so an
// "Invalid Date" can never reach the UI.

interface TimestampLike {
  toDate: () => Date;
}

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TimestampLike).toDate === "function"
  );
}

/** Convert an unknown value to a valid Date, or undefined if it isn't one. */
export function toDate(value: unknown): Date | undefined {
  let date: Date | undefined;

  if (value instanceof Date) {
    date = value;
  } else if (isTimestampLike(value)) {
    try {
      date = value.toDate();
    } catch {
      date = undefined;
    }
  } else if (typeof value === "string" && value.trim() !== "") {
    date = new Date(value);
  } else if (typeof value === "number" && Number.isFinite(value)) {
    date = new Date(value);
  }

  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

/** Like toDate, but falls back to the given date instead of undefined. */
export function toDateOr(value: unknown, fallback: Date): Date {
  return toDate(value) ?? fallback;
}

export function formatDate(
  value: unknown,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" },
  locale = "en-US"
): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString(locale, options) : "—";
}

export function formatTime(value: unknown): string {
  const date = toDate(value);
  return date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

/** "just now", "5 minutes ago", "Yesterday", "Mar 4" — for activity lists. */
export function formatRelative(value: unknown, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "—";
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday - 86_400_000) return "Yesterday";
  const days = Math.floor((startOfToday - date.getTime()) / 86_400_000) + 1;
  if (days < 7) return `${days} days ago`;
  return formatDate(date, date.getFullYear() === now.getFullYear() ? { month: "short", day: "numeric" } : undefined);
}

/** Greeting for the local time of day. */
export function greeting(now: Date = new Date()): string {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
