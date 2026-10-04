// ============================================
// Report exports (CSV / JSON), generated in the browser
// ============================================

export interface Column<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

/** Escape one CSV cell. Leading = + - @ are prefixed so spreadsheets don't run them as formulas. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T>(rows: T[], columns: Column<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(",")];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(","));
  return lines.join("\r\n");
}

export function toJson<T>(rows: T[], columns: Column<T>[]): string {
  return JSON.stringify(
    rows.map((row) => Object.fromEntries(columns.map((c) => [c.header, c.value(row) ?? null]))),
    null,
    2
  );
}

/** Save text as a file in the browser. */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isoOrEmpty(date: Date | undefined | null): string {
  return date ? date.toISOString() : "";
}
