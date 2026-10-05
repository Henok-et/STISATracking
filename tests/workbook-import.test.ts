import { describe, expect, it, vi } from 'vitest';

vi.mock('@/auth', () => ({
  auth: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}));

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { buildTemplate, parseWorkbook, DATA_SHEET, COLUMNS } from '../src/lib/imports/workbook';

/**
 * The workbook round-trip.
 *
 * A spreadsheet is the least trustworthy input the platform accepts: it is
 * edited offline, by hand, in a program that will happily reorder columns and
 * retype cells. These tests cover the ways that goes wrong, and confirm that a
 * template written by the platform reads back as the same values.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function template() {
  return buildTemplate({ countryName: 'Kenya', cycleLabel: '2026 Reporting Cycle' });
}

describe('template generation', () => {
  it('lists every active indicator', async () => {
    const expected = await prisma.indicator.count({ where: { active: true } });
    const { rows } = await parseWorkbook(await template());
    expect(rows).toHaveLength(expected);
  });

  it('carries the verbatim indicator code for every row', async () => {
    const { rows } = await parseWorkbook(await template());
    const codes = await prisma.indicator.findMany({
      where: { active: true },
      select: { code: true },
    });
    expect(new Set(rows.map((r) => r.code))).toEqual(new Set(codes.map((c) => c.code)));
  });

  it('defaults every indicator to "not reported" rather than to a value', async () => {
    const { rows } = await parseWorkbook(await template());
    expect(rows.every((r) => !r.dataAvailable)).toBe(true);
    expect(rows.every((r) => r.actual === null)).toBe(true);
  });

  it('round-trips values that were already entered', async () => {
    const first = await prisma.indicator.findFirstOrThrow({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    });
    const buffer = await buildTemplate({
      countryName: 'Kenya',
      cycleLabel: '2026 Reporting Cycle',
      existing: new Map([
        [
          first.code,
          {
            dataAvailable: true,
            notApplicable: false,
            baseline: '100',
            baselineYear: 2024,
            target: '200',
            actual: '150',
            currency: null,
            notes: 'a note',
            sourceName: 'National Bureau of Statistics',
            sourceUrl: 'https://example.org/stats',
          },
        ],
      ]),
    });

    const { rows } = await parseWorkbook(buffer);
    const row = rows.find((r) => r.code === first.code)!;
    expect(row.dataAvailable).toBe(true);
    expect(row.baseline).toBe('100');
    expect(row.target).toBe('200');
    expect(row.actual).toBe('150');
    expect(row.baselineYear).toBe(2024);
    expect(row.sourceName).toBe('National Bureau of Statistics');
  });
});

describe('parsing hostile or damaged files', () => {
  it('rejects a file that is not a workbook at all', async () => {
    const result = await parseWorkbook(Buffer.from('this is not a spreadsheet'));
    expect(result.rows).toHaveLength(0);
    expect(result.fileErrors[0]).toMatch(/could not be read/i);
  });

  it('keys on the header text, so reordered columns cannot shift values', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(DATA_SHEET);
    // Deliberately reversed relative to the template.
    const headers = [...COLUMNS].reverse().map((c) => c.header);
    sheet.addRow(headers);

    const row: Record<string, string> = {
      'Indicator code': 'LS-001',
      'Data available? (Yes/No)': 'Yes',
      'Current actual': '42',
      '2034 target': '99',
    };
    sheet.addRow(headers.map((h) => row[h] ?? null));

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const { rows } = await parseWorkbook(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.code).toBe('LS-001');
    expect(rows[0]!.actual).toBe('42');
    expect(rows[0]!.target).toBe('99');
  });

  it('reports a duplicated indicator code instead of applying it twice', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(DATA_SHEET);
    sheet.addRow(COLUMNS.map((c) => c.header));
    sheet.addRow(['LS-001', '', '', '', '', 'Yes', 'No', null, null, null, '10']);
    sheet.addRow(['LS-001', '', '', '', '', 'Yes', 'No', null, null, null, '20']);

    const { rows, fileErrors } = await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(rows).toHaveLength(1);
    expect(fileErrors.join(' ')).toMatch(/more than once/i);
  });

  it('reports a missing required column rather than guessing', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(DATA_SHEET);
    sheet.addRow(['Indicator code', 'Notes / reason if unavailable']);
    sheet.addRow(['LS-001', 'hello']);

    const { fileErrors } = await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(fileErrors.join(' ')).toMatch(/Current actual/);
  });

  it('skips blank spacer rows without treating them as data', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(DATA_SHEET);
    sheet.addRow(COLUMNS.map((c) => c.header));
    sheet.addRow(['LS-001', '', '', '', '', 'Yes', 'No', null, null, null, '10']);
    sheet.addRow([]);
    sheet.addRow([null, null, null]);

    const { rows } = await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(rows).toHaveLength(1);
  });

  it('reads a formula cell as its computed result, never evaluating the formula', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(DATA_SHEET);
    sheet.addRow(COLUMNS.map((c) => c.header));
    const r = sheet.addRow(['LS-001', '', '', '', '', 'Yes', 'No', null, null, null, null]);
    r.getCell(11).value = { formula: 'SUM(1,2)', result: 3 };

    const { rows } = await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(rows[0]!.actual).toBe('3');
  });

  it('normalises an indicator code to upper case so casing cannot cause a miss', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet(DATA_SHEET);
    sheet.addRow(COLUMNS.map((c) => c.header));
    sheet.addRow(['ls-001', '', '', '', '', 'yes', 'no', null, null, null, '5']);

    const { rows } = await parseWorkbook(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(rows[0]!.code).toBe('LS-001');
    expect(rows[0]!.dataAvailable).toBe(true);
  });
});
