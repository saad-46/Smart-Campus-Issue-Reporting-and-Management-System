// Small formatting helpers shared by admin pages.

export function formatHours(hours: number | null): string | null {
  if (hours === null) return null;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

export const currency = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
