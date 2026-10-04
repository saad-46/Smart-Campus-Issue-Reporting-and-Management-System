// ============================================
// SLA engine
// ============================================
// SLA state is always *computed* from the issue's own timestamps and the
// configured targets — it is never stored, so a client can't fake it.

import { IssueStatus, Priority, SlaConfig, SlaState, SlaStatus } from "@/types";
import {
  DEFAULT_SLA_HOURS,
  PRIORITIES,
  SLA_HOURS_MAX,
  SLA_HOURS_MIN,
  SLA_WARNING_FRACTION,
} from "@/lib/constants";

export const DEFAULT_SLA_CONFIG: SlaConfig = { hours: { ...DEFAULT_SLA_HOURS }, isDefault: true };

function validHours(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= SLA_HOURS_MIN && value <= SLA_HOURS_MAX;
}

/** Read an admin-saved config document; anything invalid falls back to the default for that priority. */
export function normalizeSlaConfig(data: Record<string, unknown> | undefined | null): SlaConfig {
  if (!data) return DEFAULT_SLA_CONFIG;
  const hours = { ...DEFAULT_SLA_HOURS };
  for (const priority of PRIORITIES) {
    const value = data[priority];
    if (validHours(value)) hours[priority] = value;
  }
  return { hours, isDefault: false };
}

export function validateSlaHours(hours: Record<Priority, number>): string | null {
  for (const priority of PRIORITIES) {
    if (!validHours(hours[priority])) {
      return `${priority}: enter a whole number of hours between ${SLA_HOURS_MIN} and ${SLA_HOURS_MAX}.`;
    }
    if (!Number.isInteger(hours[priority])) return `${priority}: use whole hours.`;
  }
  if (hours.High > hours.Medium || hours.Medium > hours.Low) {
    return "Higher priorities should have the same or a shorter target than lower ones.";
  }
  return null;
}

interface SlaInput {
  createdAt: Date;
  priority: Priority;
  status: IssueStatus;
  resolvedAt?: Date;
}

export function computeSla(issue: SlaInput, config: SlaConfig = DEFAULT_SLA_CONFIG, now: Date = new Date()): SlaStatus {
  const windowMs = config.hours[issue.priority] * 3_600_000;
  const start = issue.createdAt.getTime();
  const deadline = new Date(start + windowMs);

  if (issue.status === "Resolved") {
    const end = issue.resolvedAt?.getTime() ?? now.getTime();
    const state: SlaState = end <= deadline.getTime() ? "met" : "missed";
    return { state, deadline, remainingMs: 0, elapsedFraction: Math.min(1, (end - start) / windowMs) };
  }

  const elapsed = now.getTime() - start;
  const fraction = elapsed / windowMs;
  const state: SlaState = fraction >= 1 ? "breached" : fraction >= SLA_WARNING_FRACTION ? "approaching" : "on-track";
  return { state, deadline, remainingMs: deadline.getTime() - now.getTime(), elapsedFraction: Math.min(1, Math.max(0, fraction)) };
}

/** "3h 20m left", "2d overdue", "Met", "Missed". */
export function describeSla(status: SlaStatus): string {
  if (status.state === "met") return "Resolved within target";
  if (status.state === "missed") return "Resolved after target";
  const abs = Math.abs(status.remainingMs);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const span = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return status.remainingMs >= 0 ? `${span} left` : `${span} overdue`;
}

export const SLA_LABELS: Record<SlaState, string> = {
  "on-track": "On track",
  approaching: "Approaching deadline",
  breached: "Breached",
  met: "Met",
  missed: "Missed",
};
