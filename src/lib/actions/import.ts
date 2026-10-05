'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/db';
import { requireActor, authorizeDataEntry } from '@/lib/auth/guards';
import { parseWorkbook, type ParsedRow } from '@/lib/imports/workbook';
import { validateIndicatorValue, type RawValueInput } from '@/lib/indicators/validation';
import { refreshCompleteness } from '@/lib/submissions/readiness';
import { recordAudit, recordValueChange } from '@/lib/audit';
import { ok, fail, guarded, type ActionResult } from './shared';
import type { ValueState } from '@/generated/prisma/enums';

/**
 * Workbook import.
 *
 * A spreadsheet is a convenience, never a bypass. Every uploaded row passes
 * through the same authorization gate, the same per-indicator validation and
 * the same audit trail as a value typed into the form. Specifically:
 *
 *   - `authorizeDataEntry` still checks authenticated → role → country →
 *     submission → open cycle, and the country compared against the session
 *     comes from the freshly-read submission row, not from the file.
 *   - Indicator codes in the file are looked up; an unknown code is reported,
 *     never created.
 *   - A dry run is mandatory in the UI, so nothing is written before the focal
 *     point has seen exactly what would change.
 */

/** Uploads are capped well below the size any legitimate template reaches. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface ImportIssue {
  rowNumber: number;
  code: string;
  message: string;
}

export interface ImportChange {
  code: string;
  indicatorName: string;
  sectorName: string;
  /** What the value will become. */
  state: ValueState;
  before: string;
  after: string;
}

export interface ImportPreview {
  fileErrors: string[];
  issues: ImportIssue[];
  changes: ImportChange[];
  unchanged: number;
  unknownCodes: string[];
  /** True when apply() actually wrote. False for a dry run. */
  applied: boolean;
  totals: { rowsRead: number; willWrite: number; completenessPct?: number };
}

function describe(v: {
  dataAvailable: boolean;
  validationStatus: ValueState;
  baselineValue?: unknown;
  targetValue?: unknown;
  actualValue?: unknown;
  booleanValue?: boolean | null;
  textValue?: string | null;
}): string {
  if (v.validationStatus === 'NOT_APPLICABLE') return 'not applicable';
  if (!v.dataAvailable) return 'not reported';
  if (v.booleanValue !== null && v.booleanValue !== undefined) return v.booleanValue ? 'Yes' : 'No';
  if (v.textValue) return v.textValue.slice(0, 40);
  const actual = v.actualValue === null || v.actualValue === undefined ? '—' : String(v.actualValue);
  const target = v.targetValue === null || v.targetValue === undefined ? '—' : String(v.targetValue);
  return `actual ${actual}, target ${target}`;
}

/**
 * Reads a workbook and reports what it would do.
 *
 * `apply: false` (the default) writes nothing — it exists so the focal point
 * can see every change and every rejected value before committing.
 */
export async function importWorkbook(
  formData: FormData,
): Promise<ActionResult<ImportPreview>> {
  return guarded(async () => {
    const actor = await requireActor();

    const submissionId = String(formData.get('submissionId') ?? '');
    const apply = String(formData.get('apply') ?? '') === 'true';
    const file = formData.get('file');

    if (!submissionId) return fail('No submission specified.', 'BAD_REQUEST');
    if (!(file instanceof File)) return fail('No file was uploaded.', 'BAD_REQUEST');
    if (file.size === 0) return fail('The uploaded file is empty.', 'BAD_REQUEST');
    if (file.size > MAX_UPLOAD_BYTES) {
      return fail('That file is too large. The template is well under 5 MB.', 'FILE_TOO_LARGE');
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return fail('Upload the .xlsx template. Other formats are not accepted.', 'BAD_FORMAT');
    }

    // The full gate: country, submission, editable status, open cycle.
    const submission = await authorizeDataEntry(actor, submissionId);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, fileErrors } = await parseWorkbook(buffer);

    if (rows.length === 0) {
      const empty: ImportPreview = {
        fileErrors,
        issues: [],
        changes: [],
        unchanged: 0,
        unknownCodes: [],
        applied: false,
        totals: { rowsRead: 0, willWrite: 0 },
      };
      return ok(empty);
    }

    const indicators = await prisma.indicator.findMany({
      where: { code: { in: rows.map((r) => r.code) }, active: true },
      include: {
        sector: true,
        versions: { where: { effectiveTo: null }, orderBy: { version: 'desc' }, take: 1 },
      },
    });
    const byCode = new Map(indicators.map((i) => [i.code, i]));

    const existing = await prisma.submissionValue.findMany({
      where: { submissionId: submission.id },
    });
    const existingByIndicator = new Map(existing.map((v) => [v.indicatorId, v]));

    const issues: ImportIssue[] = [];
    const changes: ImportChange[] = [];
    const unknownCodes: string[] = [];
    let unchanged = 0;

    /** Rows that passed validation and differ from what is stored. */
    const pending: {
      row: ParsedRow;
      indicator: (typeof indicators)[number];
      data: Record<string, unknown>;
      validationStatus: ValueState;
    }[] = [];

    for (const row of rows) {
      const indicator = byCode.get(row.code);
      if (!indicator) {
        unknownCodes.push(row.code);
        issues.push({
          rowNumber: row.rowNumber,
          code: row.code,
          message: 'Not a recognised STISA 2034 indicator code. Row ignored.',
        });
        continue;
      }

      const version = indicator.versions[0];
      if (!version) {
        issues.push({
          rowNumber: row.rowNumber,
          code: row.code,
          message: 'This indicator has no active definition version. Row ignored.',
        });
        continue;
      }

      const raw: RawValueInput = {
        indicatorId: indicator.id,
        dataAvailable: row.dataAvailable,
        notApplicable: row.notApplicable,
        baselineValue: row.baseline,
        targetValue: row.target,
        actualValue: row.actual,
        // A workbook cell cannot express a tri-state boolean, so Yes/No arrives
        // as text and is interpreted per the indicator's own type.
        booleanValue:
          indicator.dataType === 'BOOLEAN' && row.actual
            ? /^(y|yes|true|1)$/i.test(row.actual)
            : null,
        textValue:
          indicator.dataType === 'TEXT' || indicator.dataType === 'URL' ? row.actual : null,
        categoricalValue: indicator.dataType === 'CATEGORICAL' ? row.actual : null,
        baselineYear: row.baselineYear,
        currencyCode: row.currency,
        notes: row.notes,
        sourceName: row.sourceName,
        sourceUrl: row.sourceUrl,
      };

      const { issues: valueIssues, parsed } = validateIndicatorValue(
        {
          code: indicator.code,
          dataType: indicator.dataType,
          calculationMethod: indicator.calculationMethod,
          unit: indicator.unit,
          required: indicator.required,
          sourceRequired: indicator.sourceRequired,
        },
        raw,
        { forSubmission: false },
      );

      for (const i of valueIssues) {
        issues.push({ rowNumber: row.rowNumber, code: row.code, message: i.message });
      }

      const validationStatus: ValueState = parsed.notApplicable
        ? 'NOT_APPLICABLE'
        : !parsed.dataAvailable
          ? 'NOT_REPORTED'
          : valueIssues.length > 0
            ? 'INVALID'
            : 'REPORTED';

      const data = {
        dataAvailable: parsed.dataAvailable,
        baselineValue: parsed.baselineValue,
        targetValue: parsed.targetValue,
        actualValue: parsed.actualValue,
        booleanValue: parsed.booleanValue,
        textValue: parsed.textValue,
        categoricalValue: parsed.categoricalValue,
        baselineYear: parsed.baselineYear,
        currencyCode: parsed.currencyCode,
        notes: parsed.notes,
        sourceName: parsed.sourceName,
        sourceUrl: parsed.sourceUrl,
        validationStatus,
        validationMessages: valueIssues.map((i) => `${i.field}: ${i.message}`),
        updatedById: actor.id,
      };

      const before = existingByIndicator.get(indicator.id);
      const beforeText = before
        ? describe({ ...before, validationStatus: before.validationStatus })
        : 'no response';
      const afterText = describe({ ...data, validationStatus });

      if (beforeText === afterText) {
        unchanged++;
        continue;
      }

      changes.push({
        code: indicator.code,
        indicatorName: indicator.officialName,
        sectorName: indicator.sector.name,
        state: validationStatus,
        before: beforeText,
        after: afterText,
      });
      pending.push({ row, indicator, data, validationStatus });
    }

    if (!apply) {
      const dryRun: ImportPreview = {
        fileErrors,
        issues,
        changes,
        unchanged,
        unknownCodes,
        applied: false,
        totals: { rowsRead: rows.length, willWrite: pending.length },
      };
      return ok(dryRun);
    }

    // ---- write ----------------------------------------------------------
    for (const item of pending) {
      const version = item.indicator.versions[0]!;
      const before = existingByIndicator.get(item.indicator.id) ?? null;

      const record = await prisma.submissionValue.upsert({
        where: {
          submissionId_indicatorId: {
            submissionId: submission.id,
            indicatorId: item.indicator.id,
          },
        },
        update: item.data,
        create: {
          submissionId: submission.id,
          indicatorId: item.indicator.id,
          indicatorVersionId: version.id,
          ...item.data,
        },
      });

      await recordValueChange(actor, {
        submissionId: submission.id,
        countryId: submission.countryId,
        indicatorCode: item.indicator.code,
        valueId: record.id,
        before: before
          ? {
              dataAvailable: before.dataAvailable,
              actualValue: before.actualValue?.toString() ?? null,
              targetValue: before.targetValue?.toString() ?? null,
              validationStatus: before.validationStatus,
            }
          : null,
        after: {
          dataAvailable: record.dataAvailable,
          actualValue: record.actualValue?.toString() ?? null,
          targetValue: record.targetValue?.toString() ?? null,
          validationStatus: record.validationStatus,
          via: 'workbook-import',
        },
      });
    }

    const totals = await refreshCompleteness(submission.id);

    await recordAudit(actor, {
      action: 'SUBMISSION_VALUE_CHANGED',
      entity: 'Submission',
      entityId: submission.id,
      countryId: submission.countryId,
      submissionId: submission.id,
      metadata: {
        via: 'workbook-import',
        fileName: file.name,
        rowsRead: rows.length,
        valuesWritten: pending.length,
        rejected: issues.length,
      },
    });

    revalidatePath('/portal');
    revalidatePath('/portal/data-entry');

    const written: ImportPreview = {
      fileErrors,
      issues,
      changes,
      unchanged,
      unknownCodes,
      applied: true,
      totals: {
        rowsRead: rows.length,
        willWrite: pending.length,
        completenessPct: totals.completenessPct,
      },
    };
    return ok(written);
  });
}
