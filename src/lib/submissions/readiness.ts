import 'server-only';

import { prisma } from '@/lib/db';
import { validateIndicatorValue, type RawValueInput } from '@/lib/indicators/validation';
import type { ValueState } from '@/generated/prisma/enums';

/**
 * Submission readiness.
 *
 * Before a country can finalise a return, every required indicator is re-checked
 * SERVER-SIDE against its own definition. The focal point sees the full list of
 * blocking issues at once rather than one error at a time.
 */

export interface ReadinessIssue {
  indicatorId: string;
  indicatorCode: string;
  indicatorName: string;
  sectorCode: string;
  sectorName: string;
  field: string;
  message: string;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface ReadinessReport {
  ready: boolean;
  checks: ReadinessCheck[];
  issues: ReadinessIssue[];
  totals: {
    expected: number;
    reported: number;
    notApplicable: number;
    missing: number;
    invalid: number;
    completenessPct: number;
  };
}

/**
 * Evaluates a submission against every rule that must hold before it is final.
 * Pure read — never mutates.
 */
export async function evaluateReadiness(submissionId: string): Promise<ReadinessReport> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      values: {
        include: {
          indicator: { include: { sector: true } },
        },
      },
    },
  });

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found.`);
  }

  const activeIndicators = await prisma.indicator.findMany({
    where: { active: true },
    include: { sector: true },
    orderBy: { sortOrder: 'asc' },
  });

  const valueByIndicator = new Map(submission.values.map((v) => [v.indicatorId, v]));

  const issues: ReadinessIssue[] = [];
  let reported = 0;
  let notApplicable = 0;
  let missing = 0;
  let invalid = 0;
  let missingSources = 0;
  let missingTargets = 0;

  for (const indicator of activeIndicators) {
    const value = valueByIndicator.get(indicator.id);

    const push = (field: string, message: string) =>
      issues.push({
        indicatorId: indicator.id,
        indicatorCode: indicator.code,
        indicatorName: indicator.officialName,
        sectorCode: indicator.sector.code,
        sectorName: indicator.sector.name,
        field,
        message,
      });

    if (!value) {
      missing++;
      if (indicator.required) push('actualValue', 'No response recorded.');
      continue;
    }

    if (value.validationStatus === 'NOT_APPLICABLE') {
      notApplicable++;
      continue;
    }

    if (!value.dataAvailable) {
      missing++;
      // Marking data unavailable is permitted, but it must be explained so the
      // gap is auditable rather than silent.
      if (indicator.required && !value.notes) {
        push('notes', 'Data marked unavailable — explain why in the notes.');
      }
      continue;
    }

    // Re-validate the stored value against the indicator's current definition.
    const raw: RawValueInput = {
      indicatorId: indicator.id,
      dataAvailable: value.dataAvailable,
      baselineValue: value.baselineValue?.toString() ?? null,
      targetValue: value.targetValue?.toString() ?? null,
      actualValue: value.actualValue?.toString() ?? null,
      booleanValue: value.booleanValue,
      textValue: value.textValue,
      categoricalValue: value.categoricalValue,
      baselineYear: value.baselineYear,
      currencyCode: value.currencyCode,
      notes: value.notes,
      sourceName: value.sourceName,
      sourceUrl: value.sourceUrl,
      notApplicable: false,
    };

    const { issues: valueIssues } = validateIndicatorValue(
      {
        code: indicator.code,
        dataType: indicator.dataType,
        calculationMethod: indicator.calculationMethod,
        unit: indicator.unit,
        required: indicator.required,
        sourceRequired: indicator.sourceRequired,
      },
      raw,
      { forSubmission: true },
    );

    if (valueIssues.length > 0) {
      invalid++;
      for (const i of valueIssues) {
        push(i.field, i.message);
        if (i.field === 'sourceName') missingSources++;
      }
    } else {
      reported++;
    }

    // Targets are a separate concern from validity: the source document supplies
    // none, so countries must set their own before a return can be finalised.
    if (
      indicator.required &&
      value.dataAvailable &&
      value.targetValue === null &&
      indicator.dataType !== 'BOOLEAN' &&
      indicator.dataType !== 'TEXT' &&
      indicator.dataType !== 'URL'
    ) {
      missingTargets++;
      push('targetValue', 'Target value missing.');
    }
  }

  const expected = activeIndicators.filter((i) => i.required).length;
  const answered = reported + notApplicable;
  const completenessPct = expected === 0 ? 0 : round2((answered / expected) * 100);

  const checks: ReadinessCheck[] = [
    {
      key: 'responses',
      label: 'Required indicators completed',
      passed: missing === 0,
      detail:
        missing === 0
          ? `All ${expected} required indicators have a response.`
          : `${missing} of ${expected} indicators have no response.`,
    },
    {
      key: 'validity',
      label: 'Reported values valid',
      passed: invalid === 0,
      detail:
        invalid === 0 ? 'All reported values pass validation.' : `${invalid} values fail validation.`,
    },
    {
      key: 'targets',
      label: 'Targets entered',
      passed: missingTargets === 0,
      detail:
        missingTargets === 0
          ? 'Every reported numeric indicator has a target.'
          : `${missingTargets} reported indicators have no target value.`,
    },
    {
      key: 'sources',
      label: 'Sources provided where required',
      passed: missingSources === 0,
      detail:
        missingSources === 0
          ? 'Sources are documented for all reported values.'
          : `${missingSources} reported values have no source.`,
    },
  ];

  return {
    ready: issues.length === 0,
    checks,
    issues,
    totals: {
      expected,
      reported,
      notApplicable,
      missing,
      invalid,
      completenessPct,
    },
  };
}

/**
 * Recomputes and persists the cached completeness counters on a submission.
 *
 * Cached so the admin overview can list all 55 Member States without an N+1
 * query per country. Called after every value mutation and status change.
 */
export async function refreshCompleteness(submissionId: string): Promise<{
  reportedCount: number;
  expectedCount: number;
  completenessPct: number;
}> {
  const [expectedCount, counts] = await Promise.all([
    prisma.indicator.count({ where: { active: true, required: true } }),
    prisma.submissionValue.groupBy({
      by: ['validationStatus'],
      where: { submissionId },
      _count: { _all: true },
    }),
  ]);

  const byState = new Map<ValueState, number>(
    counts.map((c) => [c.validationStatus, c._count._all]),
  );

  // Both a valid figure and an explicit "not applicable" count as answered.
  const reportedCount = (byState.get('REPORTED') ?? 0) + (byState.get('NOT_APPLICABLE') ?? 0);
  const completenessPct = expectedCount === 0 ? 0 : round2((reportedCount / expectedCount) * 100);

  await prisma.submission.update({
    where: { id: submissionId },
    data: { reportedCount, expectedCount, completenessPct },
  });

  return { reportedCount, expectedCount, completenessPct };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
