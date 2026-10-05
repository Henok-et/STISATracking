import { prisma } from '@/lib/db';
import { countryDataset } from '@/lib/exports/datasets';
import { csvResponse, exportFilename } from '@/lib/exports/csv';

export const runtime = 'nodejs';
export const revalidate = 300;

/**
 * GET /api/v1/public/exports/country/{ISO2}.csv?year=2026
 *
 * Published data only. The `.csv` suffix in the URL is cosmetic — it makes the
 * download obvious to a browser — and is stripped before lookup.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const iso2 = code.replace(/\.csv$/i, '').toUpperCase();

  if (!/^[A-Z]{2}$/.test(iso2)) {
    return Response.json({ error: 'Invalid Member State code.' }, { status: 400 });
  }

  const country = await prisma.country.findUnique({
    where: { iso2 },
    select: { shortName: true, active: true },
  });
  if (!country || !country.active) {
    return Response.json({ error: 'Member State not found.' }, { status: 404 });
  }

  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  if (yearParam && !Number.isInteger(year)) {
    return Response.json({ error: 'Invalid year.' }, { status: 400 });
  }

  const body = await countryDataset(iso2, year);
  return csvResponse(
    exportFilename(['STISA-2034', country.shortName, year ?? 'all-cycles']),
    body,
  );
}
