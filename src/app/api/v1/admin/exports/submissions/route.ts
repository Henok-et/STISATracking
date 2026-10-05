import { currentActor } from '@/lib/auth/guards';
import { roleHas } from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/audit';
import { toCsv, csvResponse, exportFilename } from '@/lib/exports/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/admin/exports/submissions?year=2026
 *
 * The administrative dataset: every submission regardless of workflow state,
 * including drafts. Restricted to actors holding the administrative export
 * capability, and the export itself is audited.
 */
export async function GET(request: Request) {
  const actor = await currentActor();
  if (!actor) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  if (!roleHas(actor.role, 'export:administrative')) {
    return Response.json({ error: 'Not permitted.' }, { status: 403 });
  }

  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  if (yearParam && !Number.isInteger(year)) {
    return Response.json({ error: 'Invalid year.' }, { status: 400 });
  }

  const submissions = await prisma.submission.findMany({
    where: year ? { reportingCycle: { reportingYear: year } } : {},
    include: {
      country: { include: { region: true } },
      reportingCycle: true,
      submittedBy: { select: { name: true, email: true } },
      approvedBy: { select: { name: true } },
      publishedBy: { select: { name: true } },
    },
    orderBy: [{ reportingCycle: { reportingYear: 'asc' } }, { country: { shortName: 'asc' } }],
  });

  const headers = [
    'reporting_year',
    'phase',
    'country_iso2',
    'country',
    'au_region',
    'status',
    'reported_indicators',
    'expected_indicators',
    'completeness_pct',
    'submitted_at',
    'submitted_by',
    'approved_at',
    'approved_by',
    'published_at',
    'published_by',
    'revision_note',
  ];

  const rows = submissions.map((s) => [
    s.reportingCycle.reportingYear,
    s.reportingCycle.phase,
    s.country.iso2,
    s.country.shortName,
    s.country.region.name,
    s.status,
    s.reportedCount,
    s.expectedCount,
    Number(s.completenessPct),
    s.submittedAt?.toISOString() ?? null,
    s.submittedBy?.name ?? null,
    s.approvedAt?.toISOString() ?? null,
    s.approvedBy?.name ?? null,
    s.publishedAt?.toISOString() ?? null,
    s.publishedBy?.name ?? null,
    s.revisionNote,
  ]);

  await recordAudit(actor, {
    action: 'EXPORT_GENERATED',
    entity: 'Submission',
    metadata: { dataset: 'admin_submissions', reportingYear: year ?? 'all', rows: rows.length },
  });

  return csvResponse(
    exportFilename(['STISA-2034', 'submissions', year ?? 'all-cycles']),
    toCsv(headers, rows),
  );
}
