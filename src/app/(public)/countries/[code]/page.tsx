import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ExternalLink, FileDown } from 'lucide-react';

import { getCountryProfile } from '@/lib/analytics/queries';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AnchorButton, ButtonLink } from '@/components/ui/button-link';
import {
  StatCard,
  StatusBadge,
  Meter,
  DataBasis,
  SectionHeading,
  TargetTrack,
  pct,
} from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { TrendChart } from '@/components/charts';
import { formatIndicatorValue } from '@/lib/indicators/validation';
import type { IndicatorDataType } from '@/generated/prisma/enums';
import type { ProgressNarrative } from '@/lib/analytics/progress';

/**
 * Rendered on first request and then revalidated, rather than pre-built for
 * all 55 Member States. Published data changes between deployments, so a
 * build-time snapshot would go stale, and this keeps the build independent of
 * a live database.
 */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const country = await prisma.country.findUnique({
    where: { iso2: code.toUpperCase() },
    select: { shortName: true, name: true },
  });
  if (!country) return { title: 'Member State not found' };
  return {
    title: country.shortName,
    description: `STISA 2034 reporting and performance for ${country.name}.`,
  };
}

export default async function CountryProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const [tProfile, tKpi, tCp, tTrend, tTable, tCommon, tChart, tNote] = await Promise.all([
    getTranslations('countries.profile'),
    getTranslations('dashboard.kpi'),
    getTranslations('countryProfile'),
    getTranslations('dashboard.trend'),
    getTranslations('table'),
    getTranslations('common'),
    getTranslations('chart'),
    getTranslations('progressNote'),
  ]);

  const { code } = await params;
  const { year } = await searchParams;

  const requestedYear = year ? Number(year) : undefined;
  const profile = await getCountryProfile(
    code,
    Number.isFinite(requestedYear) ? requestedYear : undefined,
  );

  if (!profile) notFound();

  const { country, availableCycles, selectedYear, indicators } = profile;
  const hasData = availableCycles.length > 0;

  const trendData = profile.trend.map((t) => ({
    year: String(t.reportingYear),
    completeness: t.completenessPct,
    progress: t.targetProgressPct,
    countriesReporting: t.countriesReporting,
  }));

  const reported = indicators.filter((i) => i.validationStatus === 'REPORTED');

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <Reveal>
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{country.regionName}</Badge>
            <Badge variant="outline" className="font-mono">{country.iso3}</Badge>
            <StatusBadge status={profile.status} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{country.shortName}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{country.name}</p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {availableCycles.map((c) => (
              <ButtonLink
                key={c.reportingYear}
                href={`/countries/${country.iso2}?year=${c.reportingYear}`}
                size="sm"
                variant={c.reportingYear === selectedYear ? 'default' : 'outline'}
              >
                {c.label}
              </ButtonLink>
            ))}
            {hasData ? (
              <AnchorButton
                size="sm"
                variant="secondary"
                href={`/api/v1/public/exports/country/${country.iso2}.csv${selectedYear ? `?year=${selectedYear}` : ''}`}
              >
                <FileDown className="size-4" />
                {tProfile('downloadCsv')}
              </AnchorButton>
            ) : null}
          </div>
        </div>
      </Reveal>

      {!hasData ? (
        <Reveal>
          <Card className="border-dashed">
            <CardContent className="space-y-2 p-8 text-center">
              <h2 className="font-heading text-lg font-semibold">{tProfile('noData')}</h2>
              <p className="text-muted-foreground mx-auto max-w-lg text-sm leading-relaxed">
                {tProfile('noDataBody', { country: country.shortName })}
              </p>
            </CardContent>
          </Card>
        </Reveal>
      ) : (
        <>
          <section className="bento mb-10">
            <Reveal className="lg:col-span-4">
              <StatCard
                label={tKpi('completeness')}
                value={profile.completeness.value === null ? null : pct(profile.completeness.value)}
                suffix="%"
                aggregate={profile.completeness}
              />
            </Reveal>
            <Reveal delay={0.05} className="lg:col-span-4">
              <StatCard
                label={tKpi('progress')}
                value={
                  profile.targetProgress.value === null ? null : pct(profile.targetProgress.value)
                }
                suffix="%"
                aggregate={profile.targetProgress}
              />
            </Reveal>
            <Reveal delay={0.1} className="lg:col-span-4">
              <StatCard
                label={tProfile('cyclesPublished')}
                value={availableCycles.length}
                hint={availableCycles.map((c) => c.reportingYear).join(', ')}
              />
            </Reveal>
          </section>

          <section className="bento mb-10">
            <Reveal className="lg:col-span-7">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{tProfile('sectorPerformance')}</CardTitle>
                  <CardDescription>
                    {tCp('sectorPerfDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {profile.sectors.map((s) => (
                    <div key={s.sectorCode} className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <Link
                          href={`/sectors/${s.sectorCode}`}
                          className="hover:text-primary text-sm font-medium hover:underline"
                        >
                          {s.sectorName}
                        </Link>
                        <span className="text-muted-foreground text-xs tnum">
                          {tCp('indicatorsOf', { reported: s.reported, expected: s.expected })}
                        </span>
                      </div>
                      <Meter
                        tone="progress"
                        value={s.targetProgress.value}
                        emptyLabel={tCommon('notScored')}
                        label={
                          s.targetProgress.value === null
                            ? undefined
                            : tChart('targetProgressPct', { pct: pct(s.targetProgress.value) })
                        }
                      />
                      <DataBasis basis={s.targetProgress.basis} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </Reveal>

            <Reveal delay={0.05} className="lg:col-span-5">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{tTrend('title')}</CardTitle>
                  <CardDescription>
                    {tCp('trendDescription', { country: country.shortName })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendChart data={trendData} />
                </CardContent>
              </Card>
            </Reveal>
          </section>

          <Reveal>
            <Card>
              <CardHeader>
                <SectionHeading
                  title={tProfile('indicatorResults')}
                  description={tCp('indicatorResultsDescription', {
                    reported: reported.length,
                    total: indicators.length,
                    year: selectedYear ?? '',
                  })}
                />
              </CardHeader>
              <CardContent>
                <div className="scroll-x">
                  <table className="w-full min-w-[56rem] text-sm">
                    <thead>
                      <tr className="border-b">
                        <th scope="col" className="text-muted-foreground py-2 pr-3 text-left text-xs font-medium">{tTable('code')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pr-3 text-left text-xs font-medium">{tTable('indicator')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium">{tTable('baseline')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium">{tTable('target')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pr-3 text-right text-xs font-medium">{tTable('actual')}</th>
                        <th scope="col" className="text-muted-foreground py-2 pr-3 text-left text-xs font-medium">{tTable('progress')}</th>
                        <th scope="col" className="text-muted-foreground py-2 text-left text-xs font-medium">{tTable('source')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.map((i) => (
                        <tr key={i.indicatorCode} className="hover:bg-muted/40 border-b last:border-0 align-top">
                          <td className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap">{i.indicatorCode}</td>
                          <td className="max-w-md py-2.5 pr-3">
                            <p className="leading-snug">{i.indicatorName}</p>
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              {i.sectorName} · {i.unit}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-right tnum">
                            {formatIndicatorValue(i.baseline, i.dataType as IndicatorDataType, i.currencyCode)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tnum">
                            {formatIndicatorValue(i.target, i.dataType as IndicatorDataType, i.currencyCode)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tnum font-medium">
                            {i.validationStatus === 'REPORTED' || i.validationStatus === 'INVALID'
                              ? formatIndicatorValue(i.actual, i.dataType as IndicatorDataType, i.currencyCode)
                              : '—'}
                          </td>
                          <td className="w-72 min-w-64 py-2.5 pr-3">
                            {/* The reported value sits in the Actual column to the left, so the
                                track only names its two ends and where the value fell between them. */}
                            <TargetTrack
                              percent={i.progressPct}
                              narrative={i.progressNarrative as ProgressNarrative}
                              baselineLabel={
                                i.baseline === null
                                  ? null
                                  : formatIndicatorValue(i.baseline, i.dataType as IndicatorDataType, i.currencyCode)
                              }
                              targetLabel={
                                i.target === null
                                  ? null
                                  : formatIndicatorValue(i.target, i.dataType as IndicatorDataType, i.currencyCode)
                              }
                              reason={tNote(i.progressNarrative as ProgressNarrative)}
                            />
                            {i.progressPct !== null ? (
                              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                                {tNote(i.progressNarrative as ProgressNarrative)}
                              </p>
                            ) : null}
                          </td>
                          <td className="py-2.5 text-xs">
                            {i.sourceUrl ? (
                              <a
                                href={i.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary inline-flex items-center gap-1 hover:underline"
                              >
                                {i.sourceName ?? 'Source'}
                                <ExternalLink className="size-3" />
                              </a>
                            ) : (
                              <span className="text-muted-foreground">{i.sourceName ?? '—'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </>
      )}
    </div>
  );
}
