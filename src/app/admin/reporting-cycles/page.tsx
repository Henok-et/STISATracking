import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { getAllCycles } from '@/lib/admin/queries';
import { getStrategyTimeline, getReportingAvailability } from '@/lib/reporting/cycles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { CycleManager } from './cycle-manager';

export const metadata: Metadata = {
  title: 'Reporting cycles',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminReportingCyclesPage() {
  const [t, tAdmin] = await Promise.all([
    getTranslations('adminPages'),
    getTranslations('admin'),
  ]);

  await requireAdminOrRedirect('/admin/reporting-cycles');

  const [cycles, timeline, availability] = await Promise.all([
    getAllCycles(),
    getStrategyTimeline(),
    getReportingAvailability(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <SectionHeading
          className="mb-6"
          title={tAdmin('cycles')}
          description={t('cyclesDescription')}
        />
      </Reveal>

      <Reveal>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('strategyTimeline')}</CardTitle>
            <CardDescription>
              {availability.open
                ? t('reportingOpenFor', { year: availability.cycle?.reportingYear ?? '' })
                : (availability.reason ?? t('reportingCurrentlyClosed'))}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scroll-x pb-2">
              <ol className="flex min-w-max gap-2">
                {timeline.map((y) => (
                  <li key={y.year} className="min-w-[5.5rem]">
                    <div
                      className={[
                        'rounded-lg border px-3 py-2.5 text-center',
                        y.state === 'OPEN' && 'border-success/40 bg-success/10',
                        y.state === 'CLOSED' && 'border-primary/25 bg-primary/6',
                        y.state === 'SCHEDULED' && 'border-accent/40 bg-accent/8',
                        y.state === 'NOT_A_REPORTING_YEAR' && 'bg-muted/50 border-dashed',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <p className="font-heading text-base font-semibold tnum">{y.year}</p>
                      <p className="text-muted-foreground mt-0.5 text-[0.68rem] leading-tight">
                        {y.state === 'OPEN' && t('yearOpen')}
                        {y.state === 'CLOSED' && t('yearClosed')}
                        {y.state === 'SCHEDULED' && t('yearScheduled')}
                        {y.state === 'NOT_A_REPORTING_YEAR' && t('yearNone')}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <CycleManager
          cycles={cycles.map((c) => ({
            id: c.id,
            phase: c.phase,
            reportingYear: c.reportingYear,
            implementationStartYear: c.implementationStartYear,
            implementationEndYear: c.implementationEndYear,
            label: c.label,
            status: c.status,
            active: c.active,
            opensAt: c.opensAt.toISOString().slice(0, 10),
            closesAt: c.closesAt.toISOString().slice(0, 10),
            submissionCount: c._count.submissions,
            notes: c.notes,
          }))}
        />
      </Reveal>
    </div>
  );
}
