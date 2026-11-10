// CSV export (RFC 4180, CRLF rows), shared by every Studio download.
const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell. Leading =+-@ gets a ' so spreadsheets do not run it as a formula. */
function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== value ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Header row first, then the data rows. */
export const toCsv = (header: readonly string[], rows: readonly (readonly string[])[]): string =>
  [header, ...rows].map((r) => r.map(cell).join(',') + '\r\n').join('');
