import type { Metadata } from 'next';
import { LockKeyhole } from 'lucide-react';

import { getTranslations } from 'next-intl/server';
import { requireActorOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getReportingAvailability } from '@/lib/reporting/cycles';
import { evaluateReadiness } from '@/lib/submissions/readiness';
import { isEditable } from '@/lib/submissions/workflow';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ButtonLink } from '@/components/ui/button-link';
import { StatusBadge } from '@/components/data-display';
import { DataEntryWorkspace, type WorkspaceSector } from './workspace';

export const metadata: Metadata = {
  title: 'Data entry',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function DataEntryPage() {
  const [t, tx] = await Promise.all([
    getTranslations('portal'),
    getTranslations('portalExtra'),
  ]);

  const actor = await requireActorOrRedirect('/portal/data-entry');

  if (!actor.countryId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert variant="destructive">
          <AlertTitle>{tx('noCountryTitle')}</AlertTitle>
          <AlertDescription>{tx('noCountryBody')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const availability = await getReportingAvailability();

  // Reporting is not open: show the closed state rather than a misleading form.
  if (!availability.open || !availability.cycle) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="border-dashed">
          <CardContent className="space-y-4 p-10 text-center">
            <LockKeyhole className="text-muted-foreground mx-auto size-8" aria-hidden />
            <h1 className="font-heading text-xl font-semibold">
              {tx('reportingYear', { year: new Date().getUTCFullYear() })}
            </h1>
            <p className="text-muted-foreground mx-auto max-w-lg text-sm leading-relaxed">
              {availability.reason}
            </p>
            {availability.nextCycle ? (
              <p className="text-sm">
                {t('nextCycle')}{' '}
                <strong className="tnum">{availability.nextCycle.reportingYear}</strong>
              </p>
            ) : null}
            <ButtonLink href="/portal" variant="secondary">
              {tx('returnToOverview')}
            </ButtonLink>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cycle = availability.cycle;

  // The draft is created lazily on first visit so a focal point never lands on
  // an empty screen, but only ever for their own country and the open cycle.
  let submission = await prisma.submission.findUnique({
    where: {
      countryId_reportingCycleId: { countryId: actor.countryId, reportingCycleId: cycle.id },
    },
  });

  if (!submission) {
    const expectedCount = await prisma.indicator.count({ where: { active: true, required: true } });
    submission = await prisma.submission.create({
      data: {
        countryId: actor.countryId,
        reportingCycleId: cycle.id,
        status: 'DRAFT',
        createdById: actor.id,
        expectedCount,
      },
    });
  }

  const [sectors, values, readiness] = await Promise.all([
    prisma.sector.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        indicators: { where: { active: true }, orderBy: { sortOrder: 'asc' } },
      },
    }),
    prisma.submissionValue.findMany({ where: { submissionId: submission.id } }),
    evaluateReadiness(submission.id),
  ]);

  const valueByIndicator = new Map(values.map((v) => [v.indicatorId, v]));

  const workspaceSectors: WorkspaceSector[] = sectors
    .filter((s) => s.indicators.length > 0)
    .map((s) => ({
      code: s.code,
      name: s.name,
      subtitle: s.subtitle,
      resultLevel: s.resultLevel,
      indicators: s.indicators.map((i) => {
        const v = valueByIndicator.get(i.id);
        return {
          id: i.id,
          code: i.code,
          officialName: i.officialName,
          sourceText: i.sourceText,
          definition: i.definition,
          unit: i.unit,
          dataType: i.dataType,
          calculationMethod: i.calculationMethod,
          direction: i.direction,
          ambiguityNote: i.ambiguityNote,
          flags: i.flags,
          required: i.required,
          sourceRequired: i.sourceRequired,
          value: v
            ? {
                dataAvailable: v.dataAvailable,
                notApplicable: v.validationStatus === 'NOT_APPLICABLE',
                baselineValue: v.baselineValue?.toString() ?? '',
                targetValue: v.targetValue?.toString() ?? '',
                actualValue: v.actualValue?.toString() ?? '',
                booleanValue: v.booleanValue,
                textValue: v.textValue ?? '',
                categoricalValue: v.categoricalValue ?? '',
                baselineYear: v.baselineYear,
                currencyCode: v.currencyCode ?? '',
                notes: v.notes ?? '',
                sourceName: v.sourceName ?? '',
                sourceUrl: v.sourceUrl ?? '',
                validationStatus: v.validationStatus,
                validationMessages: v.validationMessages,
              }
            : null,
        };
      }),
    }));

  const editable = isEditable(submission.status);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {!editable ? (
        <Alert className="mb-6">
          <LockKeyhole className="size-4" />
          <AlertTitle className="flex flex-wrap items-center gap-2">
            {tx('submissionLocked')}
            <StatusBadge status={submission.status} />
          </AlertTitle>
          <AlertDescription className="leading-relaxed">
            {tx('submissionLockedBody')}
          </AlertDescription>
        </Alert>
      ) : null}

      {submission.status === 'REVISION_REQUIRED' && submission.revisionNote ? (
        <Alert className="border-warning/40 bg-warning/8 mb-6">
          <AlertTitle>{tx('revisionsRequested')}</AlertTitle>
          <AlertDescription className="leading-relaxed">{submission.revisionNote}</AlertDescription>
        </Alert>
      ) : null}

      <DataEntryWorkspace
        key={`${submission.id}:${submission.status}:${submission.updatedAt.toISOString()}`}
        submissionId={submission.id}
        status={submission.status}
        editable={editable}
        countryName={actor.countryName ?? ''}
        cycleLabel={cycle.label}
        phaseLabel={cycle.phase === 'PHASE_1' ? tx('phase1') : tx('phase2')}
        closesAt={cycle.closesAt.toISOString()}
        sectors={workspaceSectors}
        initialReadiness={{
          totals: readiness.totals,
          checks: readiness.checks,
          issueCount: readiness.issues.length,
        }}
      />
    </div>
  );
}
