import { z } from 'zod';
import type { CalculationMethod, IndicatorDataType } from '@/generated/prisma/enums';

/**
 * Per-indicator value validation.
 *
 * The indicator's own `dataType` decides how its value is validated — the 75
 * MEAL Plan rows are not uniformly numeric, and nothing here assumes they are.
 * The same rules run on the client (for immediate feedback) and on the server
 * (as the enforcement point).
 */

export interface IndicatorRule {
  code: string;
  dataType: IndicatorDataType;
  /**
   * Needed because the legal range of a percentage depends on it: a share of a
   * total cannot exceed 100%, whereas a percentage *change* is routinely
   * negative and may well exceed 100.
   */
  calculationMethod: CalculationMethod;
  unit: string;
  required: boolean;
  sourceRequired: boolean;
}

/** The raw shape a data-entry form submits for one indicator. */
export const rawValueSchema = z.object({
  indicatorId: z.string().min(1),
  dataAvailable: z.boolean(),
  baselineValue: z.string().trim().max(100).optional().nullable(),
  targetValue: z.string().trim().max(100).optional().nullable(),
  actualValue: z.string().trim().max(100).optional().nullable(),
  booleanValue: z.boolean().optional().nullable(),
  textValue: z.string().trim().max(5000).optional().nullable(),
  categoricalValue: z.string().trim().max(200).optional().nullable(),
  baselineYear: z.number().int().min(1990).max(2100).optional().nullable(),
  currencyCode: z.string().trim().length(3).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  sourceName: z.string().trim().max(500).optional().nullable(),
  sourceUrl: z.string().trim().max(2000).optional().nullable(),
  /** The country states this indicator does not apply to it. */
  notApplicable: z.boolean().optional().default(false),
});

export type RawValueInput = z.infer<typeof rawValueSchema>;

export interface FieldIssue {
  field: string;
  message: string;
}

export interface ParsedValue {
  dataAvailable: boolean;
  baselineValue: number | null;
  targetValue: number | null;
  actualValue: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
  categoricalValue: string | null;
  baselineYear: number | null;
  currencyCode: string | null;
  notes: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  notApplicable: boolean;
}

export interface ValidationOutcome {
  issues: FieldIssue[];
  parsed: ParsedValue;
}

const NUMERIC_TYPES: IndicatorDataType[] = ['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY'];

export function isNumericType(t: IndicatorDataType): boolean {
  return NUMERIC_TYPES.includes(t);
}

function parseNumber(input: string | null | undefined): number | null | 'INVALID' {
  if (input === null || input === undefined || input === '') return null;
  // Tolerate thousands separators and unicode minus from pasted spreadsheet data.
  const cleaned = input.replace(/[\s, ]/g, '').replace(/−/g, '-');
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return 'INVALID';
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 'INVALID';
}

function checkNumeric(
  label: string,
  field: string,
  raw: string | null | undefined,
  dataType: IndicatorDataType,
  calculationMethod: CalculationMethod,
  issues: FieldIssue[],
): number | null {
  const n = parseNumber(raw);
  if (n === 'INVALID') {
    issues.push({ field, message: `${label} must be a number.` });
    return null;
  }
  if (n === null) return null;

  if (dataType === 'INTEGER' && !Number.isInteger(n)) {
    issues.push({ field, message: `${label} must be a whole number.` });
    return null;
  }
  if (dataType === 'INTEGER' && n < 0) {
    issues.push({ field, message: `${label} cannot be negative for a count.` });
    return null;
  }
  if (dataType === 'CURRENCY' && n < 0) {
    issues.push({ field, message: `${label} cannot be negative.` });
    return null;
  }
  // Percentages are not clamped globally: several STISA indicators are
  // "percentage change", which is legitimately negative and can exceed 100.
  // A share of a total is different — it is bounded by definition, and a value
  // outside 0-100 is a data error, not an ambitious result.
  if (dataType === 'PERCENTAGE' && calculationMethod === 'SHARE_OF_TOTAL') {
    if (n < 0 || n > 100) {
      issues.push({
        field,
        message: `${label} is a share of a total and must be between 0 and 100.`,
      });
      return null;
    }
  }
  if (Math.abs(n) > 1e15) {
    issues.push({ field, message: `${label} is out of range.` });
    return null;
  }
  return n;
}

/**
 * Validates one indicator value against its own definition.
 *
 * Returns issues rather than throwing so a data-entry screen can show every
 * problem across all 75 indicators at once.
 */
export function validateIndicatorValue(
  rule: IndicatorRule,
  input: RawValueInput,
  options: { forSubmission: boolean } = { forSubmission: false },
): ValidationOutcome {
  const issues: FieldIssue[] = [];
  const notApplicable = input.notApplicable ?? false;

  const parsed: ParsedValue = {
    dataAvailable: false,
    baselineValue: null,
    targetValue: null,
    actualValue: null,
    booleanValue: null,
    textValue: null,
    categoricalValue: null,
    baselineYear: input.baselineYear ?? null,
    currencyCode: input.currencyCode ?? null,
    notes: input.notes || null,
    sourceName: input.sourceName || null,
    sourceUrl: input.sourceUrl || null,
    notApplicable,
  };

  // "Not applicable" is a first-class answer, distinct from "no data".
  if (notApplicable) {
    if (!parsed.notes) {
      issues.push({
        field: 'notes',
        message: 'Explain in the notes why this indicator does not apply.',
      });
    }
    return { issues, parsed };
  }

  // Missing data is recorded as missing — never coerced to zero.
  if (!input.dataAvailable) {
    parsed.dataAvailable = false;
    return { issues, parsed };
  }

  parsed.dataAvailable = true;

  if (isNumericType(rule.dataType)) {
    const num = (label: string, field: string, raw: string | null | undefined) =>
      checkNumeric(label, field, raw, rule.dataType, rule.calculationMethod, issues);

    parsed.baselineValue = num('Baseline', 'baselineValue', input.baselineValue);
    parsed.targetValue = num('Target', 'targetValue', input.targetValue);
    parsed.actualValue = num('Current actual', 'actualValue', input.actualValue);

    if (parsed.actualValue === null && !issues.some((i) => i.field === 'actualValue')) {
      issues.push({
        field: 'actualValue',
        message: 'Enter a current actual value, or mark the data as unavailable.',
      });
    }

    if (rule.dataType === 'CURRENCY' && parsed.actualValue !== null && !parsed.currencyCode) {
      issues.push({
        field: 'currencyCode',
        message: 'Specify the currency — the STISA source document does not fix one.',
      });
    }
  } else if (rule.dataType === 'BOOLEAN') {
    if (input.booleanValue === null || input.booleanValue === undefined) {
      issues.push({ field: 'booleanValue', message: 'Select Yes or No.' });
    } else {
      parsed.booleanValue = input.booleanValue;
    }
  } else if (rule.dataType === 'CATEGORICAL') {
    if (!input.categoricalValue) {
      issues.push({ field: 'categoricalValue', message: 'Select a category.' });
    } else {
      parsed.categoricalValue = input.categoricalValue;
    }
  } else if (rule.dataType === 'URL') {
    const v = input.textValue;
    if (!v) {
      issues.push({ field: 'textValue', message: 'Enter a URL.' });
    } else if (!isHttpUrl(v)) {
      issues.push({ field: 'textValue', message: 'Enter a valid http(s) URL.' });
    } else {
      parsed.textValue = v;
    }
  } else {
    // TEXT
    if (!input.textValue) {
      issues.push({ field: 'textValue', message: 'Enter a value.' });
    } else {
      parsed.textValue = input.textValue;
    }
  }

  if (parsed.sourceUrl && !isHttpUrl(parsed.sourceUrl)) {
    issues.push({ field: 'sourceUrl', message: 'The source link must be a valid http(s) URL.' });
  }

  // Source citation is only demanded at final submission, so drafts stay easy
  // to save incrementally.
  if (options.forSubmission && rule.sourceRequired && !parsed.sourceName && !parsed.sourceUrl) {
    issues.push({
      field: 'sourceName',
      message: 'Provide a data source (name or link) for reported values.',
    });
  }

  return { issues, parsed };
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Formats a stored value for display according to its indicator type. */
export function formatIndicatorValue(
  value: number | null,
  dataType: IndicatorDataType,
  currencyCode?: string | null,
): string {
  if (value === null || value === undefined) return '—';
  switch (dataType) {
    case 'PERCENTAGE':
      return `${trimNumber(value)}%`;
    case 'CURRENCY':
      return `${currencyCode ? `${currencyCode} ` : ''}${new Intl.NumberFormat('en').format(value)}`;
    case 'INTEGER':
      return new Intl.NumberFormat('en').format(value);
    default:
      return trimNumber(value);
  }
}

function trimNumber(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(rounded);
}
