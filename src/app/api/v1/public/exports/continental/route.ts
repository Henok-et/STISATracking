import { continentalDataset } from '@/lib/exports/datasets';
import { csvResponse, exportFilename } from '@/lib/exports/csv';

export const runtime = 'nodejs';
export const revalidate = 300;

/**
 * GET /api/v1/public/exports/continental?year=2026
 *
 * Every published indicator value across all reporting Member States.
 */
export async function GET(request: Request) {
  const yearParam = new URL(request.url).searchParams.get('year');
  const year = yearParam ? Number(yearParam) : undefined;
  if (yearParam && !Number.isInteger(year)) {
    return Response.json({ error: 'Invalid year.' }, { status: 400 });
  }

  const body = await continentalDataset(year);
  return csvResponse(exportFilename(['STISA-2034', 'continental', year ?? 'all-cycles']), body);
}
