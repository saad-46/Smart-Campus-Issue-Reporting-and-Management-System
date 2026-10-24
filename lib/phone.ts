// Phone numbers are stored and verified in E.164 (+<country><number>).
// A bare 10-digit number is read as Indian, because that is who this campus
// serves; any other country must be typed with its + prefix.

export const DEFAULT_COUNTRY_CODE = "+91";

/** E.164 for what the person typed, or null when it can't be one. */
export function normalizePhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const compact = input.replace(/[\s\-().]/g, "");
  if (/^\d{10}$/.test(compact) && /^[6-9]/.test(compact)) return `${DEFAULT_COUNTRY_CODE}${compact}`;
  if (/^0\d{10}$/.test(compact) && /^0[6-9]/.test(compact)) return `${DEFAULT_COUNTRY_CODE}${compact.slice(1)}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

export function phoneError(input: string): string {
  if (!input.trim()) return "Enter your phone number.";
  return normalizePhone(input) ? "" : "Enter a valid phone number, e.g. 98765 43210 or +44 20 7946 0958.";
}

/** Same number? Compares the normalised forms. */
export function samePhone(a: string, b: string): boolean {
  const x = normalizePhone(a);
  return !!x && x === normalizePhone(b);
}
