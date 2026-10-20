import Link from 'next/link';
import { getFormatter, getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  ChevronDown,
  Database,
  FileText,
  Globe2,
  Target,
} from 'lucide-react';

import {
  getContinentalOverview,
  getRegionalPerformance,
  getSectorPerformance,
  getCountryLeaderboard,
  getCountrySectorHeatmap,
  getHistoricalTrend,
} from '@/lib/analytics/queries';
import { getReportingAvailability } from '@/lib/reporting/cycles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button-link';
import { StatCard, pct } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { TrendChart } from '@/components/charts';
import { ReportingGlobe } from '@/components/reporting-globe';
import { SectorPerformancePanel } from './_components/sector-performance';
import { RegionList } from './_components/region-list';
import { CountryHeatmap } from './_components/country-heatmap';
import { LeaderboardTable } from './_components/leaderboard-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const revalidate = 300;

/**
 * Continental dashboard.
 *
 * Below the hero the page answers four questions in order: how much data
 * arrived and how it scores (KPIs, with the two figures defined once directly
 * underneath); which Member States reported; how each category of the
 * framework stands; how the regions compare. Every list uses the same
 * two-meter row, so the reader learns one encoding for two numbers.
 *
 * The category-by-state heatmap is kept but collapsed — it is the densest
 * block and carries only completeness, which the state table already shows.
 * The trend appears once there are two published cycles to compare.
 */
export default async function ContinentalDashboard() {
  const [t, format] = await Promise.all([getTranslations('dashboard'), getFormatter()]);

  const [overview, regions, sectors, leaderboard, heatmap, trend, availability] =
    await Promise.all([
      getContinentalOverview(),
      getRegionalPerformance(),
      getSectorPerformance(),
      getCountryLeaderboard(),
      getCountrySectorHeatmap(),
      getHistoricalTrend(),
      getReportingAvailability(),
    ]);

  const trendData = trend.map((t) => ({
    year: String(t.reportingYear),
    completeness: t.completenessPct,
    progress: t.targetProgressPct,
    countriesReporting: t.countriesReporting,
  }));

  const hasPublishedData = overview.publishedReports > 0;

  // Every Member State appears on the globe as its own boundary. Those without
  // a published return carry a null completeness, which the globe renders in a
  // distinct "not reported" fill rather than as 0% — the same rule the rest of
  // the platform applies to absent data.
  const globeCountries = leaderboard.map((r) => ({
    iso2: r.iso2,
    name: r.name,
    completeness: r.status === 'PUBLISHED' ? r.completeness.value : null,
    targetProgress: r.status === 'PUBLISHED' ? r.targetProgress.value : null,
    reported: r.completeness.n,
    expected: r.completeness.expected,
  }));
  const reportingNames = leaderboard
    .filter((r) => r.status === 'PUBLISHED')
    .map((r) => r.name)
    .join(', ');

  const howCalculated = (
    <Link
      href="/methodology"
      className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
    >
      {t('kpi.howCalculated')} <ArrowRight className="size-3" aria-hidden />
    </Link>
  );

  // One sentence on the schedule replaces the year-tile strip. The date
  // comes from ReportingCycle; nothing here knows what year it is.
  const scheduleLine = availability.open && availability.cycle
    ? t('schedule.openLine', {
        cycle: availability.cycle.label,
        date: format.dateTime(availability.cycle.closesAt, { dateStyle: 'long' }),
      })
    : availability.nextCycle
      ? t('schedule.closedLine', {
          cycle: availability.nextCycle.label,
          date: format.dateTime(availability.nextCycle.opensAt, { dateStyle: 'long' }),
        })
      : t('schedule.closedNoNext');

  // ------------------------------------------------------------------ //
  // Hero                                                                //
  // ------------------------------------------------------------------ //
  const hero = (
    <Reveal>
      <section className="mb-10 rounded-2xl border bg-gradient-to-br from-primary/8 via-transparent to-accent/5 p-6 ring-1 ring-primary/10 sm:p-8 lg:grid lg:grid-cols-12 lg:items-center lg:gap-10">
        <div className="lg:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/30 bg-primary/8 text-primary">
              {overview.cycleLabel ?? t('cyclePending')}
            </Badge>
            {availability.open ? (
              <Badge variant="outline" className="border-success/30 bg-success/10 text-success">
                {t('reportingOpen')}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                {t('reportingClosed')}
              </Badge>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl lg:text-5xl">
            {t('title')}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-relaxed sm:text-lg">
            {t('intro')}
          </p>

          {hasPublishedData ? (
            <p className="text-muted-foreground mt-5 text-sm">
              {t('globeSummary', {
                reporting: overview.countriesReporting,
                total: overview.totalCountries,
              })}
            </p>
          ) : null}

          {!hasPublishedData ? (
            <Card className="border-accent/40 bg-accent/8 mt-6">
              <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
                <FileText className="text-accent-foreground size-4 shrink-0" aria-hidden />
                <span className="text-accent-foreground">
                  {t('noDataYet', { cycle: overview.cycleLabel ?? '' })}
                </span>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* The globe carries data, not decoration: one marker per Member
            State that has actually published. */}
        <div className="mt-8 lg:col-span-5 lg:mt-0">
          <ReportingGlobe
            className="mx-auto w-full max-w-[24rem] lg:max-w-none"
            countries={globeCountries}
            summary={
              hasPublishedData
                ? t('globeAria', {
                    reporting: overview.countriesReporting,
                    total: overview.totalCountries,
                    cycle: overview.cycleLabel ?? '',
                    names: reportingNames,
                  })
                : t('globeAriaEmpty')
            }
          />
        </div>
      </section>
    </Reveal>
  );

  // ------------------------------------------------------------------ //
  // Empty state: nothing published yet. The hero already says so; offer  //
  // the three places a reader can still go instead of nine empty cards.  //
  // ------------------------------------------------------------------ //
  if (!hasPublishedData) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
        {hero}
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{scheduleLine}</p>
        <Reveal>
          <section aria-label={t('empty.aria')} className="grid gap-4 sm:grid-cols-3">
            <ButtonLink href="/methodology" variant="outline" className="h-auto justify-between py-3">
              {t('empty.methodology')} <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/sectors" variant="outline" className="h-auto justify-between py-3">
              {t('empty.framework')} <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/countries" variant="outline" className="h-auto justify-between py-3">
              {t('empty.countries')} <ArrowRight className="size-4" />
            </ButtonLink>
          </section>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      {hero}

      {/* ---------------------------------------------------------------- */}
      {/* Schedule, in one sentence                                         */}
      {/* ---------------------------------------------------------------- */}
      <p className="text-muted-foreground mb-6 text-sm leading-relaxed">{scheduleLine}</p>

      {/* ---------------------------------------------------------------- */}
      {/* Dashboard Tabs                                                    */}
      {/* ---------------------------------------------------------------- */}
      <Tabs defaultValue="overview" className="mt-8">
        <div className="mb-8 flex overflow-x-auto pb-2">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="countries">Member States</TabsTrigger>
            <TabsTrigger value="sectors">Sectors & Regions</TabsTrigger>
            {trend.length >= 2 && <TabsTrigger value="trends">Trends</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-10 focus-visible:outline-none">
          {/* ---------------------------------------------------------------- */}
          {/* KPIs                                                              */}
          {/* ---------------------------------------------------------------- */}
          <section aria-label={t('kpiRegion')} className="bento">
            <Reveal className="lg:col-span-4">
              <StatCard
                label={t('kpi.completeness')}
                value={overview.dataCompleteness.value === null ? null : pct(overview.dataCompleteness.value)}
                suffix="%"
                aggregate={overview.dataCompleteness}
                icon={<Database className="size-4" />}
                tone="primary"
                footer={howCalculated}
              />
            </Reveal>
            <Reveal delay={0.05} className="lg:col-span-4">
              <StatCard
                label={t('kpi.reporting')}
                value={`${overview.countriesReporting} / ${overview.totalCountries}`}
                hint={t('kpi.reportingHint', {
                  missing: overview.totalCountries - overview.countriesReporting,
                  indicators: overview.totalIndicators,
                })}
                icon={<Globe2 className="size-4" />}
                tone="accent"
                footer={
                  <Link
                    href="/countries"
                    className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  >
                    {t('kpi.seeStates')} <ArrowRight className="size-3" aria-hidden />
                  </Link>
                }
              />
            </Reveal>
            <Reveal delay={0.1} className="lg:col-span-4">
              <StatCard
                label={t('kpi.progress')}
                value={overview.targetProgress.value === null ? null : pct(overview.targetProgress.value)}
                suffix="%"
                aggregate={overview.targetProgress}
                hint={
                  overview.unscoredIndicators > 0
                    ? t('kpi.unscoredHint', { count: overview.unscoredIndicators })
                    : undefined
                }
                icon={<Target className="size-4" />}
                footer={howCalculated}
              />
            </Reveal>
          </section>

          {/* ---------------------------------------------------------------- */}
          {/* Explain the two figures once, then never again on this page       */}
          {/* ---------------------------------------------------------------- */}
          <Reveal>
            <section
              aria-label={t('explainerStrip.aria')}
              className="bg-muted/40 grid gap-4 rounded-lg border px-4 py-4 text-sm sm:grid-cols-2 sm:px-5"
            >
              <p className="leading-relaxed">
                <span
                  aria-hidden
                  className="me-2 inline-block size-2.5 rounded-full bg-[var(--color-chart-1)] align-middle"
                />
                <span className="font-medium">{t('explainerStrip.completenessTerm')}</span>{' '}
                <span className="text-muted-foreground">{t('explainerStrip.completenessBody')}</span>
              </p>
              <p className="leading-relaxed">
                <span
                  aria-hidden
                  className="me-2 inline-block size-2.5 rounded-full bg-[var(--color-chart-2)] align-middle"
                />
                <span className="font-medium">{t('explainerStrip.progressTerm')}</span>{' '}
                <span className="text-muted-foreground">{t('explainerStrip.progressBody')}</span>
              </p>
              <p className="text-muted-foreground border-t pt-3 text-xs leading-relaxed sm:col-span-2">
                {t('explainerStrip.missing')}{' '}
                <Link href="/methodology" className="text-primary font-medium hover:underline">
                  {t('explainerStrip.link')}
                </Link>
              </p>
            </section>
          </Reveal>

          {/* ---------------------------------------------------------------- */}
          {/* Heatmap — collapsed; the densest block, and completeness only     */}
          {/* ---------------------------------------------------------------- */}
          <Reveal>
            <details className="group rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-6 [&::-webkit-details-marker]:hidden">
                <div>
                  <h2 className="font-heading text-lg font-semibold leading-none">{t('heatmap.title')}</h2>
                  <p className="text-muted-foreground mt-1.5 text-sm">{t('heatmap.description')}</p>
                </div>
                <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-xs font-medium">
                  {t('heatmap.toggle')}
                  <ChevronDown
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </span>
              </summary>
              <div className="px-6 pb-6">
                <CountryHeatmap heatmap={heatmap} />
              </div>
            </details>
          </Reveal>
        </TabsContent>

        <TabsContent value="countries" className="focus-visible:outline-none">
          {/* ---------------------------------------------------------------- */}
          {/* Member States                                                     */}
          {/* ---------------------------------------------------------------- */}
          <Reveal>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{t('leaderboard.title')}</CardTitle>
                  <CardDescription>{t('leaderboard.description')}</CardDescription>
                </div>
                <ButtonLink href="/countries" variant="ghost" size="sm">
                  {t('leaderboard.viewAll')} <ArrowRight className="size-4" />
                </ButtonLink>
              </CardHeader>
              <CardContent>
                <LeaderboardTable rows={leaderboard} limit={12} />
              </CardContent>
            </Card>
          </Reveal>
        </TabsContent>

        <TabsContent value="sectors" className="space-y-10 focus-visible:outline-none">
          {/* ---------------------------------------------------------------- */}
          {/* Categories                                                        */}
          {/* ---------------------------------------------------------------- */}
          <Reveal>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{t('sectors.title')}</CardTitle>
                  <CardDescription>{t('sectors.description')}</CardDescription>
                </div>
                <ButtonLink href="/sectors" variant="ghost" size="sm">
                  {t('sectors.viewAll')} <ArrowRight className="size-4" />
                </ButtonLink>
              </CardHeader>
              <CardContent>
                <SectorPerformancePanel sectors={sectors} />
              </CardContent>
            </Card>
          </Reveal>

          {/* ---------------------------------------------------------------- */}
          {/* Regions                                                           */}
          {/* ---------------------------------------------------------------- */}
          <Reveal>
            <Card>
              <CardHeader>
                <CardTitle>{t('regional.title')}</CardTitle>
                <CardDescription>{t('regional.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <RegionList regions={regions} />
              </CardContent>
            </Card>
          </Reveal>
        </TabsContent>

        {/* ---------------------------------------------------------------- */}
        {/* Trend — only once there are two cycles to compare                 */}
        {/* ---------------------------------------------------------------- */}
        {trend.length >= 2 ? (
          <TabsContent value="trends" className="focus-visible:outline-none">
            <Reveal>
              <Card>
                <CardHeader>
                  <CardTitle>{t('trend.title')}</CardTitle>
                  <CardDescription>{t('trend.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart data={trendData} />
                  <ul className="mt-4 space-y-1.5">
                    {trend.map((t) => (
                      <li key={t.reportingYear} className="text-muted-foreground text-xs">
                        <span className="text-foreground font-medium tnum">{t.reportingYear}</span>{' '}
                        — {t.basis}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Reveal>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
