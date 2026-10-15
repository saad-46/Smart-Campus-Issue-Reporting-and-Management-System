// Small formatting helpers shared by admin pages.

import { formatInr } from "@/lib/financeLedger";

export function formatHours(hours: number | null): string | null {
  if (hours === null) return null;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

// One money format everywhere (₹1,25,000.00): the same function the balance tile and the transactions ledger use.
export const currency = formatInr;
