// ============================================
// Analytics date ranges
// ============================================

export type RangePreset = "today" | "7d" | "30d" | "90d" | "semester" | "custom";

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  semester: "This semester",
  custom: "Custom range",
};

/** Longest custom range accepted (keeps queries bounded and charts readable). */
export const MAX_RANGE_DAYS = 366;

export interface DateRange {
  from: Date;
  to: Date;
}

const DAY = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/**
 * Semesters are assumed to run January–June and July–December (a common
 * Indian academic calendar). Change here if the campus uses other dates.
 */
export function semesterStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() >= 6 ? 6 : 0, 1);
}

/** Parse a yyyy-mm-dd value from a date input (local time); null if invalid. */
export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The range for a preset, or for custom yyyy-mm-dd bounds (error message when invalid). */
export function resolveRange(
  preset: RangePreset,
  now: Date,
  custom: { from: string; to: string } = { from: "", to: "" }
): DateRange | { error: string } {
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: now };
    case "7d":
      return { from: new Date(now.getTime() - 7 * DAY), to: now };
    case "30d":
      return { from: new Date(now.getTime() - 30 * DAY), to: now };
    case "90d":
      return { from: new Date(now.getTime() - 90 * DAY), to: now };
    case "semester":
      return { from: semesterStart(now), to: now };
    case "custom": {
      const from = parseDateInput(custom.from);
      const to = parseDateInput(custom.to);
      if (!from || !to) return { error: "Choose both a start and an end date." };
      if (from > to) return { error: "The start date must be on or before the end date." };
      if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY) return { error: `Choose a range of at most ${MAX_RANGE_DAYS} days.` };
      return { from: startOfDay(from), to: endOfDay(to) };
    }
  }
}
