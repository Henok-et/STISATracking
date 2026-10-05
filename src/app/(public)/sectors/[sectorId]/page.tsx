import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlertTriangle } from 'lucide-react';

import { getSectorDetail } from '@/lib/analytics/queries';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { StatCard, Meter, NoData, SectionHeading, TargetTrack, pct } from '@/components/data-display';
import { BasisHint } from '@/components/basis-hint';
import { Reveal } from '@/components/reveal';
import { FigureExplainer } from '@/components/figure-explainer';
import { RegionalComparisonChart, TrendChart } from '@/components/charts';
import type { CalculationMethod, Direction } from '@/generated/prisma/enums';

/** Rendered on first request, then revalidated. See the country profile route. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sectorId: string }>;
}): Promise<Metadata> {
  const { sectorId } = await params;
  const sector = await prisma.sector.findUnique({
    where: { code: sectorId.toUpperCase() },
    select: { name: true, subtitle: true },
  });
  if (!sector) return { title: 'Sector not found' };
  return { title: sector.name, description: sector.subtitle ?? undefined };
}

/** Flags that mean the indicator text itself needs AU clarification. */
const NOTABLE_FLAGS = new Set([
  'COMPOUND_STATEMENT',
  'DUPLICATE_OF_ANOTHER_ROW',
  'OVERLAPS_ANOTHER_ROW',
  'REQUIRES_DISAGGREGATION',
  'CONTINENTAL_LEVEL_WORDING',
  'UNIT_NOT_SPECIFIED',
  'AMBIGUOUS_MEASUREMENT_BASIS',
]);

export default async function SectorPage({
  params,
  searchParams,
}: {
  params: Promise<{ sectorId: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const [tSectors, tSd, tKpi, tDash, tTable, tCommon, tFlags, tLevel] = await Promise.all([
    getTranslations('sectors'),
    getTranslations('sectorDetail'),
    getTranslations('dashboard.kpi'),
    getTranslations('dashboard'),
    getTranslations('table'),
    getTranslations('common'),
    getTranslations('flags'),
    getTranslations('resultLevel'),
  ]);

  const [tMethod, tDirection, tMethodHelp, tDirectionHelp] = await Promise.all([
    getTranslations('method'),
    getTranslations('direction'),
    getTranslations('methodHelp'),
    getTranslations('directionHelp'),
  ]);

  const { sectorId } = await params;
  const { year } = await searchParams;
  const requested = year ? Number(year) : undefined;

  const detail = await getSectorDetail(sectorId, Number.isFinite(requested) ? requested : undefined);
  if (!detail) notFound();

  const { sector, indicators, continental, regions, countries, trend } = detail;

  const regionalData = regions.map((r) => ({
    region: r.regionName.replace(' Africa', ''),
    completeness: r.completeness.value,
    progress: r.targetProgress.value,
    countriesReporting: r.countriesReporting,
    countriesTotal: r.countriesTotal,
  }));

  const trendData = trend.map((t) => ({
    year: String(t.reportingYear),
    completeness: t.completenessPct,
    progress: t.targetProgressPct,
    countriesReporting: t.countriesReporting,
  }));

  const flagged = indicators.filter((i) => i.flags.some((f) => NOTABLE_FLAGS.has(f)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <Reveal>
        <div className="mb-8">
          <Badge variant="outline" className="font-mono">{sector.code}</Badge>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold sm:text-4xl">{sector.name}</h1>
          {sector.subtitle ? (
            <p className="text-muted-foreground mt-2 max-w-3xl text-base leading-relaxed">
              {sector.subtitle}
            </p>
          ) : null}
          {/*
            This statement belongs to the whole result LEVEL, not to this one
            category — the MEAL Plan states it once above the block. Unlabelled
            it reads as a description of this category, which it is not.
          */}
          {sector.resultStatement ? (
            <div className="border-primary/40 mt-4 max-w-3xl border-l-2 pl-4">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {tLevel(sector.resultLevel)}
                <span className="normal-case"> — {tSectors('sharedAtLevel')}</span>
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {sector.resultStatement}
              </p>
            </div>
          ) : null}
        </div>
      </Reveal>

      <section className="bento mb-10">
        <Reveal className="lg:col-span-4">
          <StatCard
            label={tKpi('completeness')}
            value={continental.completeness.value === null ? null : pct(continental.completeness.value)}
            suffix="%"
            aggregate={continental.completeness}
            hint={tSd('completenessHint', {
              indicators: continental.breakdown.indicatorsInSector,
              states: continental.breakdown.countriesReporting,
              expected: continental.breakdown.expectedValues,
            })}
          />
        </Reveal>
        <Reveal delay={0.05} className="lg:col-span-4">
          <StatCard
            label={tKpi('progress')}
            value={continental.targetProgress.value === null ? null : pct(continental.targetProgress.value)}
            suffix="%"
            aggregate={continental.targetProgress}
            hint={
              continental.breakdown.unscored > 0
                ? tSd('unscoredHint', { count: continental.breakdown.unscored })
                : tSd('allScoredHint')
            }
          />
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-4">
          <StatCard
            label={tKpi('reporting')}
            value={continental.countriesReporting}
            hint={tSd('statesReportingHint', { count: indicators.length })}
          />
        </Reveal>
      </section>

      <Reveal>
        <div className="mb-10">
          <FigureExplainer
            breakdown={continental.breakdown}
            completenessPct={continental.completeness.value}
            progressPct={continental.targetProgress.value}
          />
        </div>
      </Reveal>

      {flagged.length > 0 ? (
        <Reveal>
          <Alert className="border-warning/40 bg-warning/8 mb-10">
            <AlertTriangle className="size-4" />
            <AlertTitle>
              {tSectors('needsClarification', { count: flagged.length })}
            </AlertTitle>
            <AlertDescription className="leading-relaxed">
              {tSectors('clarificationBody')}
            </AlertDescription>
          </Alert>
        </Reveal>
      ) : null}

      <section className="bento mb-10">
        <Reveal className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{tDash('regional.title')}</CardTitle>
              <CardDescription>
                {tSd('regionalDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RegionalComparisonChart data={regionalData} />
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={0.05} className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{tDash('trend.title')}</CardTitle>
              <CardDescription>{tSd('trendDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={trendData} />
            </CardContent>
          </Card>
        </Reveal>
      </section>

      <Reveal>
        <Card className="mb-10">
          <CardHeader>
            <SectionHeading
              title={tSectors('indicatorsIn')}
              description={tSd('indicatorsDescription')}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {indicators.map((i) => (
              <div key={i.code} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{i.code}</Badge>
                      <span className="text-muted-foreground text-xs">{i.unit}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{i.sourceText}</p>
                    <p className="text-muted-foreground text-xs">
                      {tMethod(i.calculationMethod as CalculationMethod)} ·{' '}
                      {tDirection(i.direction as Direction)}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {tMethodHelp(i.calculationMethod as CalculationMethod)}{' '}
                      {tDirectionHelp(i.direction as Direction)}
                    </p>
                  </div>

                  <div className="w-full sm:w-64 sm:shrink-0">
                    <TargetTrack
                      percent={i.targetProgress.value}
                      scores={i.scores}
                      reason={i.targetProgress.basis}
                    />
                    {i.targetProgress.value !== null ? (
                      <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-xs">
                        <span className="tnum">{i.targetProgress.basisShort}</span>
                        <BasisHint text={i.targetProgress.basis} />
                      </p>
                    ) : null}
                  </div>
                </div>

                {i.flags.filter((f) => NOTABLE_FLAGS.has(f)).length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {i.flags
                      .filter((f) => NOTABLE_FLAGS.has(f))
                      .map((f) => (
                        <Badge key={f} variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground text-[0.68rem]">
                          {tFlags(f)}
                        </Badge>
                      ))}
                  </div>
                ) : null}

                {i.ambiguityNote ? (
                  <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
                    {i.ambiguityNote}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>{tSectors('memberStateComparison')}</CardTitle>
            <CardDescription>
              {tSd('countriesDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scroll-x">
              <table className="w-full min-w-[38rem] text-sm">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="text-muted-foreground py-2 pr-3 text-left text-xs font-medium">{tTable('memberState')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pr-3 text-left text-xs font-medium">{tTable('region')}</th>
                    <th scope="col" className="text-muted-foreground py-2 pr-3 text-left text-xs font-medium">{tTable('indicatorsReported')}</th>
                    <th scope="col" className="text-muted-foreground py-2 text-left text-xs font-medium">{tTable('targetProgress')}</th>
                  </tr>
                </thead>
                <tbody>
                  {countries
                    .slice()
                    .sort((a, b) => b.reported - a.reported || a.name.localeCompare(b.name))
                    .map((c) => (
                      <tr key={c.iso2} className="hover:bg-muted/40 border-b last:border-0">
                        <td className="py-2.5 pr-3">
                          <Link href={`/countries/${c.iso2}`} className="hover:text-primary font-medium hover:underline">
                            {c.name}
                          </Link>
                        </td>
                        <td className="text-muted-foreground py-2.5 pr-3 text-xs">{c.regionName}</td>
                        <td className="py-2.5 pr-3 text-xs tnum">
                          {c.reported} / {c.expected}
                        </td>
                        <td className="w-44 py-2.5">
                          {c.targetProgress.value === null ? (
                            <NoData label={tCommon('notScored')} />
                          ) : (
                            <Meter
                              tone="progress"
                              value={c.targetProgress.value}
                              label={`${pct(c.targetProgress.value, 0)}% · ${c.targetProgress.basisShort}`}
                            />
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
    </div>
  );
}
