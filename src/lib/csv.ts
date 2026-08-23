/**
 * Escape a value for RFC-4180 CSV output and neutralize spreadsheet
 * formula injection (=, +, -, @ prefixes would execute in Excel/Sheets).
 */
export function escapeCsvCell(v: unknown): string {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
