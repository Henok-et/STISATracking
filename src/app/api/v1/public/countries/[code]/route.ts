import { getCountryProfile } from '@/lib/analytics/queries';

export const runtime = 'nodejs';
export const revalidate = 300;

/** GET /api/v1/public/countries/{ISO2}?year=2026 — published data only. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!/^[A-Za-z]{2}$/.test(code)) {
    return Response.json({ error: 'Invalid Member State code.' }, { status: 400 });
  }

  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  if (yearParam && !Number.isInteger(year)) {
    return Response.json({ error: 'Invalid year.' }, { status: 400 });
  }

  const profile = await getCountryProfile(code, year);
  if (!profile) return Response.json({ error: 'Member State not found.' }, { status: 404 });

  return Response.json({
    apiVersion: 'v1',
    country: profile.country,
    reportingYear: profile.selectedYear,
    availableCycles: profile.availableCycles.map((c) => c.reportingYear),
    status: profile.status,
    completeness: {
      percent: profile.completeness.value,
      reported: profile.completeness.n,
      expected: profile.completeness.expected,
      basis: profile.completeness.basis,
    },
    targetProgress: {
      percent: profile.targetProgress.value,
      scoredIndicators: profile.targetProgress.n,
      basis: profile.targetProgress.basis,
    },
    sectors: profile.sectors.map((s) => ({
      code: s.sectorCode,
      name: s.sectorName,
      resultLevel: s.resultLevel,
      reported: s.reported,
      expected: s.expected,
      targetProgressPercent: s.targetProgress.value,
      basis: s.targetProgress.basis,
    })),
    indicators: profile.indicators.map((i) => ({
      code: i.indicatorCode,
      name: i.indicatorName,
      sector: i.sectorCode,
      unit: i.unit,
      dataType: i.dataType,
      state: i.validationStatus,
      // Only validly reported values are exposed; anything else stays null so a
      // consumer cannot read an unreported indicator as a figure.
      baseline: i.baseline,
      target: i.target,
      actual: i.validationStatus === 'REPORTED' ? i.actual : null,
      targetProgressPercent: i.progressPct,
      progressNote: i.progressPct === null ? i.progressExplanation : null,
      source: { name: i.sourceName, url: i.sourceUrl },
    })),
    trend: profile.trend.map((t) => ({
      reportingYear: t.reportingYear,
      completenessPercent: t.completenessPct,
      targetProgressPercent: t.targetProgressPct,
      basis: t.basis,
    })),
  });
}
