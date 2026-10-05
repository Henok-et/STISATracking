import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AlertTriangle, ClipboardCheck, Globe2, KeyRound, UserX } from 'lucide-react';

import { getTranslations } from 'next-intl/server';
import { requireAdminOrRedirect } from '@/lib/auth/guards';
import { getAdminOverview } from '@/lib/admin/queries';
import { getAllCycles } from '@/lib/reporting/cycles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button-link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard, SectionHeading } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { STATUS_ORDER } from '@/lib/submissions/workflow';
import { AdminCountryTable } from './country-table';

export const metadata: Metadata = {
  title: 'Administration overview',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const [t, tPortalX, tStatus] = await Promise.all([
    getTranslations('admin'),
    getTranslations('portalExtra'),
    getTranslations('status'),
  ]);

  const actor = await requireAdminOrRedirect('/admin/overview');

  const { year } = await searchParams;
  const requested = year ? Number(year) : undefined;

  const [overview, cycles] = await Promise.all([
    getAdminOverview(Number.isFinite(requested) ? requested : undefined),
    getAllCycles(),
  ]);

  if (!overview.cycle) {
    // No cycle exists at all — an administrator must create one before any
    // reporting can happen.
    redirect('/admin/reporting-cycles');
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <Reveal>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">{t('commission')}</p>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
              {overview.cycle.label}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {overview.cycle.phase === 'PHASE_1' ? tPortalX('phase1') : tPortalX('phase2')}
              {' · '}
              {t('requiredPerState', { count: overview.expectedIndicators })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {cycles.map((c) => (
              <ButtonLink
                key={c.id}
                href={`/admin/overview?year=${c.reportingYear}`}
                size="sm"
                variant={c.reportingYear === overview.cycle!.reportingYear ? 'default' : 'outline'}
              >
                {c.reportingYear}
              </ButtonLink>
            ))}
          </div>
        </div>
      </Reveal>

      {actor.mustChangePassword ? (
        <Reveal>
          <Alert className="border-warning/40 bg-warning/8 mb-6">
            <KeyRound className="size-4" />
            <AlertTitle>{t('changePasswordTitle')}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-3">
              <span>{t('changePasswordBody')}</span>
              <ButtonLink href="/admin/account#password" size="sm" variant="secondary">
                {tPortalX('changePassword')}
              </ButtonLink>
            </AlertDescription>
          </Alert>
        </Reveal>
      ) : null}

      <section className="bento mb-8">
        <Reveal className="lg:col-span-3">
          <StatCard
            label={t('statesStarted')}
            value={`${overview.totals.started} / ${overview.totals.countries}`}
            hint={t('statesStartedHint')}
            icon={<Globe2 className="size-4" />}
            tone="primary"
          />
        </Reveal>
        <Reveal delay={0.05} className="lg:col-span-3">
          <StatCard
            label={t('awaitingReview')}
            value={overview.totals.awaitingReview}
            hint={t('awaitingReviewHint')}
            icon={<ClipboardCheck className="size-4" />}
            tone="accent"
          />
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-3">
          <StatCard
            label={tStatus('PUBLISHED')}
            value={overview.totals.published}
            hint={t('publishedHint')}
          />
        </Reveal>
        <Reveal delay={0.15} className="lg:col-span-3">
          <StatCard
            label={t('withoutFocalPoint')}
            value={overview.totals.focalPointsMissing}
            hint={t('withoutFocalPointHint')}
            icon={<UserX className="size-4" />}
          />
        </Reveal>
      </section>

      {overview.totals.focalPointsMissing > 0 ? (
        <Reveal>
          <Card className="border-warning/40 bg-warning/8 mb-8">
            <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
              <AlertTriangle className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">
                {t('focalPointWarning', { count: overview.totals.focalPointsMissing })}
              </span>
              <ButtonLink href="/admin/users" size="sm" variant="secondary">
                {t('manageFocalPoints')}
              </ButtonLink>
            </CardContent>
          </Card>
        </Reveal>
      ) : null}

      <Reveal>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('statusBreakdown')}</CardTitle>
            <CardDescription>
              {t('statusBreakdownDescription', { count: overview.totals.countries })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {STATUS_ORDER.map((status) => (
                <div key={status} className="rounded-lg border p-3 text-center">
                  <p className="font-heading text-2xl font-semibold tnum">
                    {overview.byStatus[status] ?? 0}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-tight">
                    {tStatus(status)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader>
            <SectionHeading
              title={t('reportingStatusTitle')}
              description={t('reportingStatusDescription')}
            />
          </CardHeader>
          <CardContent>
            <AdminCountryTable rows={overview.rows} />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
