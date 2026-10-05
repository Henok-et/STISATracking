'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { requireActor, authorizeDataEntry, assertCountryAccess, assertCapability } from '@/lib/auth/guards';
import { getReportingAvailability } from '@/lib/reporting/cycles';
import { validateIndicatorValue, rawValueSchema, type RawValueInput } from '@/lib/indicators/validation';
import { evaluateReadiness, refreshCompleteness } from '@/lib/submissions/readiness';
import { recordAudit, recordValueChange } from '@/lib/audit';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { ok, fail, guarded, type ActionResult } from './shared';
import type { ValueState } from '@/generated/prisma/enums';

/**
 * Focal point data entry.
 *
 * Every action here re-verifies the full chain server-side before any write:
 *   authenticated user → authorized role → authorized country →
 *   authorized submission → authorized (open) reporting cycle.
 *
 * The submission id supplied by the client is only ever used to LOAD a row;
 * the country it is compared against comes from that row, never from the
 * request. Editing an id in the payload therefore fails the ownership check
 * rather than reaching another Member State's data.
 */

/** Creates or returns this country's draft for the open reporting cycle. */
export async function ensureSubmission(): Promise<ActionResult<{ submissionId: string }>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'submission:create');

    if (!actor.countryId) {
      return fail('No Member State is assigned to your account.', 'FORBIDDEN_COUNTRY');
    }

    const availability = await getReportingAvailability();
    if (!availability.open || !availability.cycle) {
      return fail(availability.reason ?? 'Reporting is currently closed.', 'CYCLE_CLOSED');
    }

    const existing = await prisma.submission.findUnique({
      where: {
        countryId_reportingCycleId: {
          countryId: actor.countryId,
          reportingCycleId: availability.cycle.id,
        },
      },
    });

    if (existing) return ok({ submissionId: existing.id });

    const expectedCount = await prisma.indicator.count({ where: { active: true, required: true } });

    const created = await prisma.submission.create({
      data: {
        countryId: actor.countryId,
        reportingCycleId: availability.cycle.id,
        status: 'DRAFT',
        createdById: actor.id,
        expectedCount,
      },
    });

    await recordAudit(actor, {
      action: 'SUBMISSION_CREATED',
      entity: 'Submission',
      entityId: created.id,
      countryId: actor.countryId,
      submissionId: created.id,
      newValue: { status: 'DRAFT', reportingYear: availability.cycle.reportingYear },
    });

    revalidatePath('/portal');
    return ok({ submissionId: created.id });
  });
}

const saveValuesSchema = z.object({
  submissionId: z.string().min(1),
  values: z.array(rawValueSchema).min(1).max(200),
});

export interface SaveValuesResult {
  saved: number;
  /** Per-indicator validation issues, keyed by indicator id. */
  issues: Record<string, { field: string; message: string }[]>;
  completenessPct: number;
  reportedCount: number;
  expectedCount: number;
}

/**
 * Saves a batch of indicator values as a draft.
 *
 * Drafts accept partially-valid data so a focal point can save and come back —
 * invalid values are stored with `validationStatus: INVALID` and their issues
 * are returned, rather than being rejected outright. Final submission is where
 * validity is enforced.
 */
export async function saveValues(input: unknown): Promise<ActionResult<SaveValuesResult>> {
  return guarded(async () => {
    const parsed = saveValuesSchema.safeParse(input);
    if (!parsed.success) return fail('Invalid request payload.', 'BAD_REQUEST');

    const actor = await requireActor();

    const rateLimit = checkRateLimit(`saveValues:${actor.id}`, { limit: 30, windowMs: 60000 });
    if (!rateLimit.success) {
      return fail('Too many requests. Please wait a moment before saving again.', 'RATE_LIMITED');
    }

    const submission = await authorizeDataEntry(actor, parsed.data.submissionId);

    const indicatorIds = parsed.data.values.map((v) => v.indicatorId);
    const indicators = await prisma.indicator.findMany({
      where: { id: { in: indicatorIds }, active: true },
      include: { versions: { where: { effectiveTo: null }, orderBy: { version: 'desc' }, take: 1 } },
    });
    const indicatorById = new Map(indicators.map((i) => [i.id, i]));

    const issues: SaveValuesResult['issues'] = {};
    let saved = 0;

    for (const raw of parsed.data.values) {
      const indicator = indicatorById.get(raw.indicatorId);
      // Silently ignoring an unknown id would hide tampering; reject it.
      if (!indicator) {
        issues[raw.indicatorId] = [{ field: 'indicatorId', message: 'Unknown or inactive indicator.' }];
        continue;
      }

      const currentVersion = indicator.versions[0];
      if (!currentVersion) {
        issues[raw.indicatorId] = [
          { field: 'indicatorId', message: 'This indicator has no active definition version.' },
        ];
        continue;
      }

      const { issues: valueIssues, parsed: value } = validateIndicatorValue(
        {
          code: indicator.code,
          dataType: indicator.dataType,
          calculationMethod: indicator.calculationMethod,
          unit: indicator.unit,
          required: indicator.required,
          sourceRequired: indicator.sourceRequired,
        },
        raw as RawValueInput,
        { forSubmission: false },
      );

      if (valueIssues.length > 0) issues[raw.indicatorId] = valueIssues;

      const validationStatus: ValueState = value.notApplicable
        ? 'NOT_APPLICABLE'
        : !value.dataAvailable
          ? 'NOT_REPORTED'
          : valueIssues.length > 0
            ? 'INVALID'
            : 'REPORTED';

      const before = await prisma.submissionValue.findUnique({
        where: {
          submissionId_indicatorId: { submissionId: submission.id, indicatorId: indicator.id },
        },
      });

      const data = {
        dataAvailable: value.dataAvailable,
        baselineValue: value.baselineValue,
        targetValue: value.targetValue,
        actualValue: value.actualValue,
        booleanValue: value.booleanValue,
        textValue: value.textValue,
        categoricalValue: value.categoricalValue,
        baselineYear: value.baselineYear,
        currencyCode: value.currencyCode,
        notes: value.notes,
        sourceName: value.sourceName,
        sourceUrl: value.sourceUrl,
        validationStatus,
        validationMessages: valueIssues.map((i) => `${i.field}: ${i.message}`),
        updatedById: actor.id,
      };

      const record = await prisma.submissionValue.upsert({
        where: {
          submissionId_indicatorId: { submissionId: submission.id, indicatorId: indicator.id },
        },
        update: data,
        create: {
          submissionId: submission.id,
          indicatorId: indicator.id,
          indicatorVersionId: currentVersion.id,
          ...data,
        },
      });

      // Only audit real changes, so the trail stays readable under autosave.
      const changed =
        !before ||
        before.dataAvailable !== record.dataAvailable ||
        String(before.actualValue) !== String(record.actualValue) ||
        String(before.baselineValue) !== String(record.baselineValue) ||
        String(before.targetValue) !== String(record.targetValue) ||
        before.booleanValue !== record.booleanValue ||
        before.textValue !== record.textValue ||
        before.notes !== record.notes ||
        before.sourceName !== record.sourceName ||
        before.sourceUrl !== record.sourceUrl ||
        before.validationStatus !== record.validationStatus;

      if (changed) {
        await recordValueChange(actor, {
          submissionId: submission.id,
          countryId: submission.countryId,
          indicatorCode: indicator.code,
          valueId: record.id,
          before: before
            ? {
                dataAvailable: before.dataAvailable,
                baselineValue: before.baselineValue?.toString() ?? null,
                targetValue: before.targetValue?.toString() ?? null,
                actualValue: before.actualValue?.toString() ?? null,
                booleanValue: before.booleanValue,
                textValue: before.textValue,
                notes: before.notes,
                sourceName: before.sourceName,
                sourceUrl: before.sourceUrl,
                validationStatus: before.validationStatus,
              }
            : null,
          after: {
            dataAvailable: record.dataAvailable,
            baselineValue: record.baselineValue?.toString() ?? null,
            targetValue: record.targetValue?.toString() ?? null,
            actualValue: record.actualValue?.toString() ?? null,
            booleanValue: record.booleanValue,
            textValue: record.textValue,
            notes: record.notes,
            sourceName: record.sourceName,
            sourceUrl: record.sourceUrl,
            validationStatus: record.validationStatus,
          },
        });
      }

      saved++;
    }

    const totals = await refreshCompleteness(submission.id);

    revalidatePath('/portal');
    revalidatePath('/portal/data-entry');

    return ok({
      saved,
      issues,
      completenessPct: totals.completenessPct,
      reportedCount: totals.reportedCount,
      expectedCount: totals.expectedCount,
    });
  });
}

/** Runs the full readiness check without mutating anything. */
export async function checkReadiness(submissionId: string) {
  return guarded(async () => {
    const actor = await requireActor();
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, countryId: true },
    });
    if (!submission) return fail('Submission not found.', 'NOT_FOUND');
    assertCountryAccess(actor, submission.countryId);

    const report = await evaluateReadiness(submissionId);
    return ok(report);
  });
}
