import { currentActor } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { getReportingAvailability } from '@/lib/reporting/cycles';
import { buildTemplate } from '@/lib/imports/workbook';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/portal/template
 *
 * Downloads the Excel template for the signed-in focal point's own Member
 * State, pre-filled with anything already entered so the workbook round-trips.
 *
 * The country comes from the session, never from a query parameter — there is
 * deliberately no way to ask for another Member State's workbook.
 */
export async function GET() {
  const actor = await currentActor();
  if (!actor) return Response.json({ error: 'Authentication required.' }, { status: 401 });
  if (!actor.countryId) {
    return Response.json({ error: 'No Member State is assigned to your account.' }, { status: 403 });
  }

  const availability = await getReportingAvailability();
  if (!availability.open || !availability.cycle) {
    return Response.json(
      { error: availability.reason ?? 'Reporting is currently closed.' },
      { status: 409 },
    );
  }

  const country = await prisma.country.findUniqueOrThrow({
    where: { id: actor.countryId },
    select: { shortName: true },
  });

  const submission = await prisma.submission.findUnique({
    where: {
      countryId_reportingCycleId: {
        countryId: actor.countryId,
        reportingCycleId: availability.cycle.id,
      },
    },
    include: { values: { include: { indicator: { select: { code: true } } } } },
  });

  const existing = new Map(
    (submission?.values ?? []).map((v) => [
      v.indicator.code,
      {
        dataAvailable: v.dataAvailable,
        notApplicable: v.validationStatus === 'NOT_APPLICABLE',
        baseline: v.baselineValue?.toString() ?? null,
        baselineYear: v.baselineYear,
        target: v.targetValue?.toString() ?? null,
        actual: v.actualValue?.toString() ?? null,
        currency: v.currencyCode,
        notes: v.notes,
        sourceName: v.sourceName,
        sourceUrl: v.sourceUrl,
      },
    ]),
  );

  const buffer = await buildTemplate({
    countryName: country.shortName,
    cycleLabel: availability.cycle.label,
    existing,
  });

  const filename = `STISA-2034_${country.shortName.replace(/[^a-zA-Z0-9]+/g, '-')}_${availability.cycle.reportingYear}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      // A workbook contains unpublished national data — never cache it.
      'Cache-Control': 'private, no-store, max-age=0',
    },
  });
}
