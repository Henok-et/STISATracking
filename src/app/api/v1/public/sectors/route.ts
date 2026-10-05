import { getSectorPerformance } from '@/lib/analytics/queries';

export const runtime = 'nodejs';
export const revalidate = 300;

/** GET /api/v1/public/sectors?year=2026 */
export async function GET(request: Request) {
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  if (yearParam && !Number.isInteger(year)) {
    return Response.json({ error: 'Invalid year.' }, { status: 400 });
  }

  const sectors = await getSectorPerformance(year);

  return Response.json({
    apiVersion: 'v1',
    reportingYear: year ?? null,
    count: sectors.length,
    data: sectors.map((s) => ({
      code: s.sectorCode,
      name: s.sectorName,
      subtitle: s.subtitle,
      resultLevel: s.resultLevel,
      indicatorCount: s.indicatorCount,
      countriesReporting: s.countriesReporting,
      completeness: {
        percent: s.completeness.value,
        reported: s.completeness.n,
        expected: s.completeness.expected,
        basis: s.completeness.basis,
      },
      targetProgress: {
        percent: s.targetProgress.value,
        scoredValues: s.targetProgress.n,
        basis: s.targetProgress.basis,
      },
    })),
  });
}
