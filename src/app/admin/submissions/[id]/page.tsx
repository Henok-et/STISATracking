import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { evaluateReadiness } from '@/lib/submissions/readiness';
import { transitionsFrom } from '@/lib/submissions/workflow';
import { calculateProgress } from '@/lib/analytics/progress';
import { formatIndicatorValue } from '@/lib/indicators/validation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard, StatusBadge, Meter, NoData, pct } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { WorkflowActions } from './workflow-actions';

export const metadata: Metadata = {
  title: 'Review submission',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ReviewSubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [t, tPortal, tPortalX, tTable, tCommon, locale] = await Promise.all([
    getTranslations('review'),
    getTranslations('portal'),
    getTranslations('portalExtra'),
    getTranslations('table'),
    getTranslations('common'),
    getLocale(),
  ]);

  await requireAdminOrRedirect('/admin/submissions');
  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      country: { include: { region: true } },
      reportingCycle: true,
      submittedBy: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      publishedBy: { select: { name: true } },
      revisionRequestedBy: { select: { name: true } },
      values: {
        include: { indicator: { include: { sector: true } } },
        orderBy: { indicator: { sortOrder: 'asc' } },
      },
    },
  });

  if (!submission) notFound();

  const readiness = await evaluateReadiness(submission.id);
  const available = transitionsFrom(submission.status);

  const auditTrail = await prisma.auditLog.findMany({
    where: { submissionId: submission.id },
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: { user: { select: { name: true } } },
  });

  const bySector = new Map<string, typeof submission.values>();
  for (const v of submission.values) {
    const key = v.indicator.sector.name;
    const list = bySector.get(key) ?? [];
    list.push(v);
    bySector.set(key, list);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{submission.country.region.name}</Badge>
            <StatusBadge status={submission.status} />
          </div>
          <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
            {submission.country.shortName} — {submission.reportingCycle.label}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {submission.country.name} ·{' '}
            {submission.reportingCycle.phase === 'PHASE_1'
              ? tPortalX('phase1')
              : tPortalX('phase2')}
          </p>
        </div>
      </Reveal>

      <section className="bento mb-8">
        <Reveal className="lg:col-span-3">
          <StatCard
            label={tTable('completeness')}
            value={pct(readiness.totals.completenessPct, 0)}
            suffix="%"
            hint={t('completenessHint', {
              answered: readiness.totals.reported + readiness.totals.notApplicable,
              expected: readiness.totals.expected,
            })}
          />
        </Reveal>
        <Reveal delay={0.05} className="lg:col-span-3">
          <StatCard label={tPortal('reported')} value={readiness.totals.reported} />
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-3">
          <StatCard
            label={tPortal('missing')}
            value={readiness.totals.missing}
            hint={t('missingHint')}
          />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-3">
          <StatCard
            label={t('validationIssues')}
            value={readiness.totals.invalid}
            tone="accent"
          />
        </Reveal>
      </section>

      <Reveal>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('actionsTitle')}</CardTitle>
            <CardDescription>{t('actionsDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkflowActions
              submissionId={submission.id}
              status={submission.status}
              transitions={available.map((tr) => ({
                to: tr.to,
                labelKey: tr.labelKey,
                requiresNote: tr.requiresNote,
              }))}
            />

            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Timestamp
                label={t('submitted')}
                at={submission.submittedAt}
                by={submission.submittedBy?.name}
                locale={locale}
              />
              <Timestamp
                label={t('reviewStarted')}
                at={submission.reviewedAt}
                by={submission.reviewedBy?.name}
                locale={locale}
              />
              <Timestamp
                label={t('approved')}
                at={submission.approvedAt}
                by={submission.approvedBy?.name}
                locale={locale}
              />
              <Timestamp
                label={t('published')}
                at={submission.publishedAt}
                by={submission.publishedBy?.name}
                locale={locale}
              />
            </dl>

            {submission.revisionNote ? (
              <Alert className="border-warning/40 bg-warning/8 mt-6">
                <AlertTitle>
                  {submission.revisionRequestedBy
                    ? t('revisionsRequestedBy', { name: submission.revisionRequestedBy.name })
                    : tPortalX('revisionsRequested')}
                </AlertTitle>
                <AlertDescription className="leading-relaxed">
                  {submission.revisionNote}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </Reveal>

      {readiness.issues.length > 0 ? (
        <Reveal>
          <Card className="border-warning/40 mb-8">
            <CardHeader>
              <CardTitle>{t('outstandingIssues', { count: readiness.issues.length })}</CardTitle>
              <CardDescription>{t('outstandingIssuesDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
                {readiness.issues.map((i, idx) => (
                  <li key={`${i.indicatorCode}-${i.field}-${idx}`} className="text-muted-foreground">
                    <span className="text-foreground font-mono">{i.indicatorCode}</span> —{' '}
                    {i.message}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      ) : null}

      <Reveal>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('reportedValues')}</CardTitle>
            <CardDescription>
              {t('reportedValuesDescription', { count: submission.values.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {[...bySector.entries()].map(([sectorName, values]) => (
              <div key={sectorName}>
                <h3 className="mb-2 text-sm font-semibold">{sectorName}</h3>
                <div className="scroll-x">
                  <table className="w-full min-w-[50rem] text-sm">
                    <thead>
                      <tr className="border-b">
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('code')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('indicator')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-end text-xs font-medium">{tTable('baseline')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-end text-xs font-medium">{tTable('target')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-end text-xs font-medium">{tTable('actual')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pe-3 text-start text-xs font-medium">{tTable('progress')}</th>
                        <th scope="col" className="text-muted-foreground py-2 text-start text-xs font-medium">{tTable('source')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {values.map((v) => {
                        const progress = calculateProgress({
                          calculationMethod: v.indicator.calculationMethod,
                          direction: v.indicator.direction,
                          dataType: v.indicator.dataType,
                          baseline: v.baselineValue === null ? null : Number(v.baselineValue),
                          target: v.targetValue === null ? null : Number(v.targetValue),
                          actual: v.actualValue === null ? null : Number(v.actualValue),
                          booleanValue: v.booleanValue,
                        });

                        return (
                          <tr key={v.id} className="border-b align-top last:border-0">
                            <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">
                              {v.indicator.code}
                            </td>
                            <td className="max-w-sm py-2 pr-3">
                              <p className="text-xs leading-snug">{v.indicator.officialName}</p>
                              <Badge
                                variant="outline"
                                className="mt-1 text-[0.62rem]"
                              >
                                {tCommon(
                                  v.validationStatus === 'REPORTED'
                                    ? 'reported'
                                    : v.validationStatus === 'NOT_APPLICABLE'
                                      ? 'notApplicable'
                                      : 'notReported',
                                )}
                              </Badge>
                            </td>
                            <td className="py-2 pr-3 text-right text-xs tnum">
                              {formatIndicatorValue(
                                v.baselineValue === null ? null : Number(v.baselineValue),
                                v.indicator.dataType,
                                v.currencyCode,
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right text-xs tnum">
                              {formatIndicatorValue(
                                v.targetValue === null ? null : Number(v.targetValue),
                                v.indicator.dataType,
                                v.currencyCode,
                              )}
                            </td>
                            <td className="py-2 pr-3 text-right text-xs font-medium tnum">
                              {formatIndicatorValue(
                                v.actualValue === null ? null : Number(v.actualValue),
                                v.indicator.dataType,
                                v.currencyCode,
                              )}
                            </td>
                            <td className="w-32 py-2 pr-3">
                              {progress.scored ? (
                                <Meter value={progress.percent} label={`${pct(progress.percent, 0)}%`} />
                              ) : (
                                <NoData label={tCommon('notScored')} />
                              )}
                            </td>
                            <td className="py-2 text-xs">
                              {v.sourceUrl ? (
                                <a
                                  href={v.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary inline-flex items-center gap-1 hover:underline"
                                >
                                  {v.sourceName ?? t('link')}
                                  <ExternalLink className="size-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground">{v.sourceName ?? '—'}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {submission.values.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('noValuesYet')}</p>
            ) : null}
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>{t('auditTrail')}</CardTitle>
            <CardDescription>{t('auditTrailDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {auditTrail.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b pb-2 text-xs last:border-0">
                  <span className="text-muted-foreground tnum">
                    {a.createdAt.toLocaleString(locale, { timeZone: 'UTC' })}
                  </span>
                  <Badge variant="outline" className="text-[0.62rem]">
                    {a.action.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                  <span>{a.user?.name ?? a.actorEmail ?? t('system')}</span>
                  {a.metadata && typeof a.metadata === 'object' && 'indicatorCode' in a.metadata ? (
                    <span className="text-muted-foreground font-mono">
                      {String((a.metadata as Record<string, unknown>).indicatorCode)}
                    </span>
                  ) : null}
                </li>
              ))}
              {auditTrail.length === 0 ? (
                <li className="text-muted-foreground text-sm">{t('noActionsYet')}</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

function Timestamp({
  label,
  at,
  by,
  locale,
}: {
  label: string;
  at: Date | null;
  by?: string;
  locale: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm">
        {at ? (
          <>
            {at.toLocaleDateString(locale, { timeZone: 'UTC' })}
            {by ? <span className="text-muted-foreground block text-xs">{by}</span> : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}
