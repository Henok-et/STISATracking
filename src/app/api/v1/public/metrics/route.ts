import {
  getContinentalOverview,
  getRegionalPerformance,
  getHistoricalTrend,
} from '@/lib/analytics/queries';

export const runtime = 'nodejs';
export const revalidate = 300;

/** GET /api/v1/public/metrics?year=2026 — headline continental and regional figures. */
export async function GET(request: Request) {
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  if (yearParam && !Number.isInteger(year)) {
    return Response.json({ error: 'Invalid year.' }, { status: 400 });
  }

  const [overview, regions, trend] = await Promise.all([
    getContinentalOverview(year),
    getRegionalPerformance(year),
    getHistoricalTrend(),
  ]);

  return Response.json({
    apiVersion: 'v1',
    reportingYear: overview.reportingYear,
    cycle: overview.cycleLabel,
    continental: {
      totalMemberStates: overview.totalCountries,
      memberStatesReporting: overview.countriesReporting,
      publishedReports: overview.publishedReports,
      totalIndicators: overview.totalIndicators,
      unscoredValues: overview.unscoredIndicators,
      dataCompleteness: {
        percent: overview.dataCompleteness.value,
        reported: overview.dataCompleteness.n,
        expected: overview.dataCompleteness.expected,
        basis: overview.dataCompleteness.basis,
      },
      targetProgress: {
        percent: overview.targetProgress.value,
        scoredValues: overview.targetProgress.n,
        basis: overview.targetProgress.basis,
      },
    },
    regions: regions.map((r) => ({
      code: r.regionCode,
      name: r.regionName,
      memberStates: r.countriesTotal,
      memberStatesReporting: r.countriesReporting,
      completenessPercent: r.completeness.value,
      targetProgressPercent: r.targetProgress.value,
      basis: r.targetProgress.basis,
    })),
    trend: trend.map((t) => ({
      reportingYear: t.reportingYear,
      memberStatesReporting: t.countriesReporting,
      completenessPercent: t.completenessPct,
      targetProgressPercent: t.targetProgressPct,
      basis: t.basis,
    })),
    methodology: {
      missingData:
        'Missing, not-reported and not-applicable values are excluded from every numerator and denominator. They are never counted as zero.',
      unscoredIndicators:
        'Indicators for which the STISA source document defines no calculation methodology are published but never scored.',
      visibility: 'Only submissions that have been approved and published are included.',
    },
  });
}
