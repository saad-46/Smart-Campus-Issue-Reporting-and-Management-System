// ============================================
// Expense-claim wording (pure helpers)
// ============================================

/** The ledger rule allows notes of up to 500 characters. */
const NOTE_MAX = 500;
const LEGACY_PREFIX = "Receipt resolved for ";

/** Ledger note for a paid claim: the issue, then what the money was spent on. */
export function payoutNote(issueTitle: string, claimDescription?: string): string {
  const title = issueTitle.trim() || "Untitled issue";
  const spentOn = (claimDescription ?? "").trim();
  return (spentOn ? `${title} — ${spentOn}` : title).slice(0, NOTE_MAX);
}

/** Display text for a ledger note, including entries written before descriptions were stored. */
export function payoutLabel(note: string | undefined, fallback = "Payout"): string {
  const text = (note ?? "").trim();
  if (!text) return fallback;
  return text.startsWith(LEGACY_PREFIX) ? text.slice(LEGACY_PREFIX.length) || fallback : text;
}
