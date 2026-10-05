/**
 * CSV generation.
 *
 * Output is Excel-compatible: CRLF line endings and a UTF-8 BOM, so accented
 * Member State names (Côte d'Ivoire, São Tomé and Príncipe) open correctly in
 * Excel on Windows without a manual import step.
 *
 * Missing values are written as an empty cell, never as 0 — the same rule the
 * analytics engine applies, so an export can never imply data that was not
 * reported.
 */

export const CSV_BOM = '﻿';

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  // Guard against CSV formula injection when the file is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  return CSV_BOM + lines.join('\r\n') + '\r\n';
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=300',
    },
  });
}

/** Filenames are user-visible; keep them predictable and filesystem-safe. */
export function exportFilename(parts: (string | number)[]): string {
  return (
    parts
      .map((p) => String(p).replace(/[^a-zA-Z0-9-]+/g, '-'))
      .filter(Boolean)
      .join('_') + '.csv'
  );
}
