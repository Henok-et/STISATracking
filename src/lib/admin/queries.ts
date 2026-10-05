import 'server-only';

import { prisma } from '@/lib/db';
import type { SubmissionStatus } from '@/generated/prisma/enums';

/**
 * Administrative read models.
 *
 * The overview must render all 55 Member States at once, so it uses the cached
 * completeness counters on Submission rather than recomputing per country.
 */

export interface AdminCountryRow {
  countryId: string;
  iso2: string;
  name: string;
  regionCode: string;
  regionName: string;
  active: boolean;
  focalPoints: number;
  submissionId: string | null;
  status: SubmissionStatus | 'NOT_STARTED';
  reportedCount: number;
  expectedCount: number;
  completenessPct: number;
  submittedAt: Date | null;
  publishedAt: Date | null;
}

export async function getAdminOverview(reportingYear?: number) {
  const cycle = reportingYear
    ? await prisma.reportingCycle.findUnique({ where: { reportingYear } })
    : ((await prisma.reportingCycle.findFirst({ where: { status: 'OPEN' } })) ??
      (await prisma.reportingCycle.findFirst({
        where: { status: 'CLOSED' },
        orderBy: { reportingYear: 'desc' },
      })));

  const [countries, submissions, focalPointCounts, expectedIndicators] = await Promise.all([
    prisma.country.findMany({ include: { region: true }, orderBy: { shortName: 'asc' } }),
    cycle
      ? prisma.submission.findMany({ where: { reportingCycleId: cycle.id } })
      : Promise.resolve([]),
    prisma.user.groupBy({
      by: ['countryId'],
      where: { role: 'FOCAL_POINT', active: true },
      _count: { _all: true },
    }),
    prisma.indicator.count({ where: { active: true, required: true } }),
  ]);

  const submissionByCountry = new Map(submissions.map((s) => [s.countryId, s]));
  const fpByCountry = new Map(
    focalPointCounts.filter((f) => f.countryId).map((f) => [f.countryId!, f._count._all]),
  );

  const rows: AdminCountryRow[] = countries.map((c) => {
    const s = submissionByCountry.get(c.id);
    return {
      countryId: c.id,
      iso2: c.iso2,
      name: c.shortName,
      regionCode: c.region.code,
      regionName: c.region.name,
      active: c.active,
      focalPoints: fpByCountry.get(c.id) ?? 0,
      submissionId: s?.id ?? null,
      status: s?.status ?? 'NOT_STARTED',
      reportedCount: s?.reportedCount ?? 0,
      expectedCount: s?.expectedCount ?? expectedIndicators,
      completenessPct: s ? Number(s.completenessPct) : 0,
      submittedAt: s?.submittedAt ?? null,
      publishedAt: s?.publishedAt ?? null,
    };
  });

  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    cycle,
    rows,
    byStatus,
    expectedIndicators,
    totals: {
      countries: rows.length,
      started: rows.filter((r) => r.status !== 'NOT_STARTED').length,
      awaitingReview: rows.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW')
        .length,
      published: rows.filter((r) => r.status === 'PUBLISHED').length,
      focalPointsMissing: rows.filter((r) => r.focalPoints === 0 && r.active).length,
    },
  };
}

export async function getAllCycles() {
  return prisma.reportingCycle.findMany({
    orderBy: { reportingYear: 'asc' },
    include: { _count: { select: { submissions: true } } },
  });
}
