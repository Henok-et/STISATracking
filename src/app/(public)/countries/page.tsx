import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FileDown } from 'lucide-react';
import { getCountryLeaderboard, getContinentalOverview } from '@/lib/analytics/queries';
import { AnchorButton } from '@/components/ui/button-link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SectionHeading, StatCard, pct } from '@/components/data-display';
import { Reveal } from '@/components/reveal';
import { LeaderboardTable } from '../_components/leaderboard-table';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Member States',
  description:
    'STISA 2034 reporting status, data completeness and target progress for all 55 African Union Member States.',
};

export default async function CountriesPage() {
  const t = await getTranslations('countries');
  const tKpi = await getTranslations('countriesKpi');

  const [rows, overview] = await Promise.all([getCountryLeaderboard(), getContinentalOverview()]);

  const byRegion = rows.reduce<Record<string, number>>((acc, r) => {
    if (r.status === 'PUBLISHED') acc[r.regionName] = (acc[r.regionName] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <Reveal>
        <SectionHeading
          className="mb-8"
          title={t('title')}
          description={t('description', {
            total: overview.totalCountries,
            cycle: overview.cycleLabel ?? '',
          })}
          action={
            <AnchorButton
              variant="secondary"
              size="sm"
              href={`/api/v1/public/exports/continental${overview.reportingYear ? `?year=${overview.reportingYear}` : ''}`}
            >
              <FileDown className="size-4" />
              {t('downloadCsv')}
            </AnchorButton>
          }
        />
      </Reveal>

      <section className="bento mb-8">
        <Reveal className="lg:col-span-4">
          <StatCard
            label={tKpi('publishedStates')}
            value={`${overview.publishedReports} / ${overview.totalCountries}`}
            hint={tKpi('publishedStatesHint')}
          />
        </Reveal>
        <Reveal delay={0.05} className="lg:col-span-4">
          <StatCard
            label={tKpi('continentalCompleteness')}
            value={overview.dataCompleteness.value === null ? null : pct(overview.dataCompleteness.value)}
            suffix="%"
            aggregate={overview.dataCompleteness}
          />
        </Reveal>
        <Reveal delay={0.1} className="lg:col-span-4">
          <StatCard
            label={tKpi('regionsPublished')}
            value={Object.keys(byRegion).length}
            hint={tKpi('regionsHint')}
          />
        </Reveal>
      </section>

      <Reveal>
        <Card>
          <CardHeader>
            <CardTitle>{t('tableTitle')}</CardTitle>
            <CardDescription>
              {t('tableDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeaderboardTable rows={rows} showSearch />
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
