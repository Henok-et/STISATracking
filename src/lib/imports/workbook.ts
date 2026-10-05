import 'server-only';

import ExcelJS from 'exceljs';

import { prisma } from '@/lib/db';

/**
 * Excel round-trip for a Member State's return.
 *
 * Filling 75 indicators in a browser form is slow and error-prone, and most
 * national statistics offices already work in spreadsheets. So a focal point
 * can download a template pre-populated with the official indicator text,
 * complete it offline, and upload it.
 *
 * The import is NOT a shortcut past the platform's rules. An uploaded row goes
 * through exactly the same validation, the same authorization gate and the
 * same audit trail as a value typed into the form. The workbook supplies
 * values; it never supplies indicator definitions, and an unrecognised
 * indicator code is reported rather than silently created.
 */

/** Column order of the data sheet. Parsing keys on the header row, not on this. */
export const COLUMNS = [
  { key: 'code', header: 'Indicator code', width: 14, locked: true },
  { key: 'indicator', header: 'Indicator (as printed in the MEAL Plan)', width: 70, locked: true },
  { key: 'sector', header: 'Category', width: 34, locked: true },
  { key: 'unit', header: 'Unit', width: 22, locked: true },
  { key: 'dataType', header: 'Expected value type', width: 18, locked: true },
  { key: 'dataAvailable', header: 'Data available? (Yes/No)', width: 22 },
  { key: 'notApplicable', header: 'Not applicable? (Yes/No)', width: 22 },
  { key: 'baseline', header: 'Baseline', width: 14 },
  { key: 'baselineYear', header: 'Baseline year', width: 14 },
  { key: 'target', header: '2034 target', width: 14 },
  { key: 'actual', header: 'Current actual', width: 16 },
  { key: 'currency', header: 'Currency (3-letter)', width: 18 },
  { key: 'notes', header: 'Notes / reason if unavailable', width: 46 },
  { key: 'sourceName', header: 'Data source', width: 40 },
  { key: 'sourceUrl', header: 'Source link', width: 34 },
] as const;

export const DATA_SHEET = 'STISA 2034 data';
const GUIDE_SHEET = 'How to complete';

const HEADER_ROW = 1;

export interface TemplateOptions {
  countryName: string;
  cycleLabel: string;
  /** Pre-fill with whatever has already been entered, so the file round-trips. */
  existing?: Map<
    string,
    {
      dataAvailable: boolean;
      notApplicable: boolean;
      baseline: string | null;
      baselineYear: number | null;
      target: string | null;
      actual: string | null;
      currency: string | null;
      notes: string | null;
      sourceName: string | null;
      sourceUrl: string | null;
    }
  >;
}

/** Builds the .xlsx a focal point downloads. */
export async function buildTemplate(options: TemplateOptions): Promise<Buffer> {
  const indicators = await prisma.indicator.findMany({
    where: { active: true },
    include: { sector: true },
    orderBy: { sortOrder: 'asc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'STISA 2034 M&E Platform';
  wb.created = new Date();

  // ---- guidance sheet ----------------------------------------------------
  const guide = wb.addWorksheet(GUIDE_SHEET);
  guide.columns = [{ width: 110 }];
  const guidance = [
    `STISA 2034 — ${options.cycleLabel}`,
    `${options.countryName}`,
    '',
    'HOW TO COMPLETE THIS WORKBOOK',
    '',
    `1. Open the "${DATA_SHEET}" sheet. Every indicator of the STISA 2034 results framework is listed.`,
    '2. Do not add, remove or reorder rows, and do not edit the "Indicator code" column — it is how',
    '   the platform matches your figures to the framework.',
    '3. For each indicator, set "Data available?" to Yes and enter the figures.',
    '4. If your country cannot supply a figure, leave "Data available?" as No and explain why in Notes.',
    '   A blank is recorded as "not reported". It is never treated as zero.',
    '5. If an indicator does not apply to your country, set "Not applicable?" to Yes and give the reason.',
    '6. Enter numbers only — no percent signs, currency symbols or thousands separators.',
    '7. A percentage change may be negative. Report a reduction as a negative number.',
    '8. Upload the completed file in the reporting portal. You will see a preview of every change',
    '   before anything is saved, along with any values that failed validation.',
    '',
    'WHAT THIS WORKBOOK CANNOT DO',
    '',
    'It cannot change indicator definitions, add indicators, or submit your return. Uploading only',
    'fills in values; submitting for review remains a separate, deliberate action in the portal.',
    '',
    'Indicator text is transcribed verbatim from the Implementation Plan STISA 2034, Annexure 1:',
    'MEAL Plan. Baselines and targets are not specified in that document and are set by your country.',
  ];
  guidance.forEach((line, i) => {
    const row = guide.getRow(i + 1);
    row.getCell(1).value = line;
    if (i <= 1) row.font = { bold: true, size: i === 0 ? 14 : 12 };
    if (line.startsWith('HOW TO') || line.startsWith('WHAT THIS')) row.font = { bold: true };
    row.alignment = { wrapText: true, vertical: 'top' };
  });

  // ---- data sheet --------------------------------------------------------
  const sheet = wb.addWorksheet(DATA_SHEET, {
    views: [{ state: 'frozen', xSplit: 1, ySplit: HEADER_ROW }],
  });
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  const header = sheet.getRow(HEADER_ROW);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8E1537' } };
  header.alignment = { wrapText: true, vertical: 'middle' };
  header.height = 34;

  for (const indicator of indicators) {
    const prior = options.existing?.get(indicator.code);
    const row = sheet.addRow({
      code: indicator.code,
      indicator: indicator.sourceText,
      sector: indicator.sector.name,
      unit: indicator.unit,
      dataType: indicator.dataType,
      dataAvailable: prior ? (prior.dataAvailable ? 'Yes' : 'No') : 'No',
      notApplicable: prior?.notApplicable ? 'Yes' : 'No',
      baseline: prior?.baseline ?? null,
      baselineYear: prior?.baselineYear ?? null,
      target: prior?.target ?? null,
      actual: prior?.actual ?? null,
      currency: prior?.currency ?? null,
      notes: prior?.notes ?? null,
      sourceName: prior?.sourceName ?? null,
      sourceUrl: prior?.sourceUrl ?? null,
    });

    row.alignment = { vertical: 'top', wrapText: true };
    // Reference columns are visually distinct so it is obvious what not to edit.
    for (let c = 1; c <= 5; c++) {
      row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F2F3' } };
    }
    for (const col of [6, 7]) {
      row.getCell(col).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Yes,No"'],
      };
    }
  }

  sheet.autoFilter = { from: { row: HEADER_ROW, column: 1 }, to: { row: HEADER_ROW, column: COLUMNS.length } };

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParsedRow {
  rowNumber: number;
  code: string;
  dataAvailable: boolean;
  notApplicable: boolean;
  baseline: string | null;
  baselineYear: number | null;
  target: string | null;
  actual: string | null;
  currency: string | null;
  notes: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
}

export interface ParseResult {
  rows: ParsedRow[];
  /** Problems with the file itself, as opposed to with the values in it. */
  fileErrors: string[];
}

function cellText(cell: ExcelJS.Cell | undefined): string | null {
  if (!cell) return null;
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (v instanceof Date) return String(v.getUTCFullYear());
  // Formula cells expose a computed result; the formula itself is never run.
  if (typeof v === 'object' && 'result' in v) {
    const r = (v as { result?: unknown }).result;
    return r === null || r === undefined ? null : String(r).trim() || null;
  }
  if (typeof v === 'object' && 'text' in v) {
    const t = (v as { text?: unknown }).text;
    return typeof t === 'string' ? t.trim() || null : null;
  }
  return String(v).trim() || null;
}

const isYes = (s: string | null) => (s ?? '').trim().toLowerCase().startsWith('y');

/**
 * Reads an uploaded workbook into rows.
 *
 * Nothing here trusts the file: the indicator code is looked up against the
 * database by the caller, and every value is re-validated through the same
 * path as manual entry.
 */
export async function parseWorkbook(buffer: Buffer): Promise<ParseResult> {
  const fileErrors: string[] = [];
  const wb = new ExcelJS.Workbook();

  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { rows: [], fileErrors: ['That file could not be read as an Excel workbook (.xlsx).'] };
  }

  const sheet = wb.getWorksheet(DATA_SHEET) ?? wb.worksheets[0];
  if (!sheet) {
    return { rows: [], fileErrors: ['The workbook contains no sheets.'] };
  }
  if (sheet.name !== DATA_SHEET) {
    fileErrors.push(
      `Expected a sheet named "${DATA_SHEET}"; read "${sheet.name}" instead. Use the downloaded template.`,
    );
  }

  // Key on the header text so a reordered or extra column cannot shift values
  // into the wrong field.
  const headerRow = sheet.getRow(HEADER_ROW);
  const indexByKey = new Map<string, number>();
  headerRow.eachCell((cell, colNumber) => {
    const text = (cellText(cell) ?? '').toLowerCase();
    const match = COLUMNS.find((c) => c.header.toLowerCase() === text);
    if (match) indexByKey.set(match.key, colNumber);
  });

  const required = ['code', 'dataAvailable', 'actual'] as const;
  for (const key of required) {
    if (!indexByKey.has(key)) {
      const col = COLUMNS.find((c) => c.key === key)!;
      fileErrors.push(`The workbook has no "${col.header}" column.`);
    }
  }
  if (fileErrors.length > 0 && !indexByKey.has('code')) {
    return { rows: [], fileErrors };
  }

  const at = (row: ExcelJS.Row, key: string) => {
    const idx = indexByKey.get(key);
    return idx ? cellText(row.getCell(idx)) : null;
  };

  const rows: ParsedRow[] = [];
  const seen = new Set<string>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= HEADER_ROW) return;

    const code = at(row, 'code');
    if (!code) return; // blank spacer row

    if (seen.has(code)) {
      fileErrors.push(`Indicator ${code} appears more than once (row ${rowNumber}).`);
      return;
    }
    seen.add(code);

    const yearText = at(row, 'baselineYear');
    const year = yearText ? Number.parseInt(yearText, 10) : null;

    rows.push({
      rowNumber,
      code: code.toUpperCase(),
      dataAvailable: isYes(at(row, 'dataAvailable')),
      notApplicable: isYes(at(row, 'notApplicable')),
      baseline: at(row, 'baseline'),
      baselineYear: Number.isFinite(year) ? year : null,
      target: at(row, 'target'),
      actual: at(row, 'actual'),
      currency: at(row, 'currency'),
      notes: at(row, 'notes'),
      sourceName: at(row, 'sourceName'),
      sourceUrl: at(row, 'sourceUrl'),
    });
  });

  if (rows.length === 0 && fileErrors.length === 0) {
    fileErrors.push('No indicator rows were found in the workbook.');
  }

  return { rows, fileErrors };
}
