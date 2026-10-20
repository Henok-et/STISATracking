import type { Metadata } from 'next';
import { AlertCircle, CalendarClock, CheckCircle2, ClipboardList, KeyRound, LockKeyhole } from 'lucide-react';

import { getLocale, getTranslations } from 'next-intl/server';
import { requireActorOrRedirect } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getReportingAvailability, getStrategyTimeline } from '@/lib/reporting/cycles';
import { evaluateReadiness } from '@/lib/submissions/readiness';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { StatCard, StatusBadge, Meter, SectionHeading, pct } from '@/components/data-display';
import { Reveal } from '@/components/reveal';

export const metadata: Metadata = {
  title: 'Reporting portal',
  robots: { index: false, follow: false },
};

export default async function PortalDashboard() {
  const [t, tx, tStatus, tWs, locale] = await Promise.all([
    getTranslations('portal'),
    getTranslations('portalExtra'),
    getTranslations('status'),
    getTranslations('workspace'),
    getLocale(),
  ]);

  const actor = await requireActorOrRedirect('/portal');
  if (!actor.countryId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{tx('noCountryTitle')}</AlertTitle>
          <AlertDescription>
            {tx('noCountryBody')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [availability, timeline, submissions] = await Promise.all([
    getReportingAvailability(),
    getStrategyTimeline(),
    prisma.submission.findMany({
      where: { countryId: actor.countryId },
      include: { reportingCycle: true },
      orderBy: { reportingCycle: { reportingYear: 'desc' } },
    }),
  ]);

  const current = availability.cycle
    ? submissions.find((s) => s.reportingCycleId === availability.cycle!.id)
    : undefined;

  const readiness = current ? await evaluateReadiness(current.id) : null;
  const history = submissions.filter((s) => s.id !== current?.id);

  const nextYear = timeline.find((t) => t.state === 'SCHEDULED')?.year;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-gradient-to-r from-primary/8 via-transparent to-accent/5 px-6 py-5 ring-1 ring-primary/10">
          <div>
            <p className="text-muted-foreground text-sm font-medium">{actor.countryName}</p>
            <h1 className="mt-0.5 text-2xl font-semibold sm:text-3xl">
              {availability.cycle
                ? availability.cycle.label
                : tx('reportingYear', { year: new Date().getUTCFullYear() })}
            </h1>
            {availability.cycle ? (
              <p className="text-muted-foreground mt-1 text-sm">
                {availability.cycle.phase === 'PHASE_1' ? tx('phase1') : tx('phase2')}
                {` · ${tx('closes')} `}
                {availability.cycle.closesAt.toLocaleDateString(locale, {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC',
                })}
              </p>
            ) : null}
          </div>
          {current ? (
            <StatusBadge status={current.status} className="text-sm px-3 py-1" />
          ) : null}
        </div>
      </Reveal>

      {actor.mustChangePassword ? (
        <Reveal>
          <Alert className="border-warning/40 bg-warning/8 mb-6">
            <KeyRound className="size-4" />
            <AlertTitle>{tx('changePasswordTitle')}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{tx('changePasswordBody')}</span>
              <ButtonLink href="/portal/account" size="sm" variant="secondary">
                {tx('changePassword')}
              </ButtonLink>
            </AlertDescription>
          </Alert>
        </Reveal>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Reporting closed                                                    */}
      {/* ------------------------------------------------------------------ */}
      {!availability.open ? (
        <Reveal>
          <Card className="mb-8 border-dashed">
            <CardContent className="space-y-4 p-8 text-center">
              <LockKeyhole className="text-muted-foreground mx-auto size-8" aria-hidden />
              <div className="space-y-1">
                <h2 className="font-heading text-lg font-semibold">{t('reportingClosedTitle')}</h2>
                <p className="text-muted-foreground mx-auto max-w-lg text-sm leading-relaxed">
                  {availability.reason}
                </p>
              </div>
              {availability.nextCycle ? (
                <p className="text-sm">
                  {t('nextCycle')}{' '}
                  <strong className="tnum">{availability.nextCycle.reportingYear}</strong>
                </p>
              ) : null}
              <p className="text-muted-foreground text-xs">
                {tx('historyNote')}
              </p>
            </CardContent>
          </Card>
        </Reveal>
      ) : (
        <>
          {/* -------------------------------------------------------------- */}
          {/* Current cycle                                                   */}
          {/* -------------------------------------------------------------- */}
          <section className="bento mb-8">
            <Reveal className="lg:col-span-3">
              <StatCard
                label={t('submissionStatus')}
                value={current ? tStatus(current.status) : tx('notStarted')}
                hint={
                  current?.submittedAt
                    ? tx('submittedOn', { date: current.submittedAt.toLocaleDateString(locale, { timeZone: 'UTC' }) })
                    : tx('noDataSubmitted')
                }
                icon={<ClipboardList className="size-4" />}
                tone="primary"
              />
            </Reveal>
            <Reveal delay={0.05} className="lg:col-span-3">
              <StatCard
                label={t('completion')}
                value={readiness ? pct(readiness.totals.completenessPct, 0) : '0'}
                suffix="%"
                hint={
                  readiness
                    ? tx('answeredOf', {
                        answered: readiness.totals.reported + readiness.totals.notApplicable,
                        expected: readiness.totals.expected,
                      })
                    : undefined
                }
                icon={<CheckCircle2 className="size-4" />}
              />
            </Reveal>
            <Reveal delay={0.1} className="lg:col-span-3">
              <StatCard
                label={t('indicatorsReported')}
                value={readiness ? readiness.totals.reported : 0}
                hint={
                  readiness && readiness.totals.notApplicable > 0
                    ? tx('plusNotApplicable', { count: readiness.totals.notApplicable })
                    : undefined
                }
              />
            </Reveal>
            <Reveal delay={0.15} className="lg:col-span-3">
              <StatCard
                label={t('outstanding')}
                value={readiness ? readiness.totals.missing + readiness.totals.invalid : '—'}
                hint={
                  readiness
                    ? tx('missingInvalid', {
                        missing: readiness.totals.missing,
                        invalid: readiness.totals.invalid,
                      })
                    : undefined
                }
                tone="accent"
                icon={<AlertCircle className="size-4" />}
              />
            </Reveal>
          </section>

          <Reveal>
            <Card className="mb-8">
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>{t('readinessTitle')}</CardTitle>
                  <CardDescription>
                    {t('readinessDescription')}
                  </CardDescription>
                </div>
                <ButtonLink href="/portal/data-entry">
                  {current ? t('continueDataEntry') : t('beginDataEntry')}
                </ButtonLink>
              </CardHeader>
              <CardContent>
                {!readiness ? (
                  <p className="text-muted-foreground text-sm">
                    {tx('noSubmissionYet', { cycle: availability.cycle?.label ?? '' })}
                  </p>
                ) : (
                  <div className="space-y-4">
                    <Meter
                      value={readiness.totals.completenessPct}
                      label={tWs('completeLabel', { percent: pct(readiness.totals.completenessPct, 0) })}
                    />
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {readiness.checks.map((c) => (
                        <li
                          key={c.key}
                          className={[
                            'flex items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors duration-200',
                            c.passed
                              ? 'border-success/30 bg-success/8'
                              : 'border-warning/35 bg-warning/8',
                          ].join(' ')}
                        >
                          {c.passed ? (
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/20">
                              <CheckCircle2 className="text-success size-3.5" aria-hidden />
                            </span>
                          ) : (
                            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-warning/20">
                              <AlertCircle className="text-warning size-3.5" aria-hidden />
                            </span>
                          )}
                          <span>
                            <span className="font-medium">{c.label}</span>
                            <span className="text-muted-foreground block text-xs leading-relaxed">
                              {c.detail}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>

                    {readiness.issues.length > 0 ? (
                      <div className="border-warning/40 bg-warning/8 rounded-lg border p-4">
                        <p className="text-sm font-medium">
                          {tx('issuesRequireAttention', { count: readiness.issues.length })}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs">
                          {readiness.issues.slice(0, 8).map((i, idx) => (
                            <li key={`${i.indicatorCode}-${i.field}-${idx}`} className="text-muted-foreground">
                              <span className="font-mono">{i.indicatorCode}</span> — {i.message}
                            </li>
                          ))}
                        </ul>
                        {readiness.issues.length > 8 ? (
                          <p className="text-muted-foreground mt-2 text-xs">
                            {tx('andMore', { count: readiness.issues.length - 8 })}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {current?.status === 'REVISION_REQUIRED' && current.revisionNote ? (
                      <Alert className="border-warning/40 bg-warning/8">
                        <AlertCircle className="size-4" />
                        <AlertTitle>{tx('revisionsRequested')}</AlertTitle>
                        <AlertDescription className="leading-relaxed">
                          {current.revisionNote}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </Reveal>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* History                                                             */}
      {/* ------------------------------------------------------------------ */}
      <Reveal>
        <Card>
          <CardHeader>
            <SectionHeading
              title={t('historyTitle')}
              description={t('historyDescription')}
            />
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {tx('noHistory', { country: actor.countryName ?? '' })}
                {nextYear ? ` ${tx('nextScheduled', { year: nextYear })}` : ''}
              </p>
            ) : (
              <ul className="space-y-2">
                {history.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <CalendarClock className="text-muted-foreground size-4" aria-hidden />
                      <div>
                        <p className="text-sm font-medium">{s.reportingCycle.label}</p>
                        <p className="text-muted-foreground text-xs tnum">
                          {s.reportedCount} of {s.expectedCount} indicators ·{' '}
                          {Number(s.completenessPct).toFixed(0)}% complete
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.publishedAt ? (
                        <Badge variant="outline" className="text-xs">
                          {tx('publishedOn', {
                            date: s.publishedAt.toLocaleDateString(locale, { timeZone: 'UTC' }),
                          })}
                        </Badge>
                      ) : null}
                      <StatusBadge status={s.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
