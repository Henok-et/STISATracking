import { getCountryLeaderboard } from '@/lib/analytics/queries';

export const runtime = 'nodejs';
export const revalidate = 300;

/**
 * GET /api/v1/public/countries?year=2026
 *
 * Published data only. Every aggregate carries the denominator it was computed
 * over, so a consumer can never mistake partial coverage for a complete
 * dataset.
 */
export async function GET(request: Request) {
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  if (yearParam && !Number.isInteger(year)) {
    return Response.json({ error: 'Invalid year.' }, { status: 400 });
  }

  const rows = await getCountryLeaderboard(year);

  return Response.json({
    apiVersion: 'v1',
    reportingYear: year ?? null,
    count: rows.length,
    data: rows.map((r) => ({
      iso2: r.iso2,
      name: r.name,
      region: r.regionName,
      status: r.status,
      completeness: {
        percent: r.completeness.value,
        reported: r.completeness.n,
        expected: r.completeness.expected,
        basis: r.completeness.basis,
      },
      targetProgress: {
        percent: r.targetProgress.value,
        scoredIndicators: r.targetProgress.n,
        basis: r.targetProgress.basis,
      },
    })),
  });
}
