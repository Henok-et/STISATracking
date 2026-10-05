import { prisma } from '@/lib/db';
import { EXTRACTION_RECONCILIATION } from '@/data/stisa-taxonomy';

export const runtime = 'nodejs';
export const revalidate = 3600;

/**
 * GET /api/v1/public/indicators
 *
 * The indicator taxonomy itself — definitions, not data. Each entry carries the
 * provenance of its metadata and any ambiguity flags, so a consumer can see
 * which fields came from the STISA source document and which were inferred.
 */
export async function GET() {
  const indicators = await prisma.indicator.findMany({
    where: { active: true },
    include: { sector: true },
    orderBy: { sortOrder: 'asc' },
  });

  return Response.json({
    apiVersion: 'v1',
    source:
      'Implementation Plan STISA 2034 — Annexure 1: MEAL Plan, printed pages 37-40. Indicator text is transcribed verbatim.',
    reconciliation: EXTRACTION_RECONCILIATION,
    count: indicators.length,
    data: indicators.map((i) => ({
      code: i.code,
      officialName: i.officialName,
      sourceText: i.sourceText,
      definition: i.definition,
      sector: { code: i.sector.code, name: i.sector.name, resultLevel: i.sector.resultLevel },
      unit: i.unit,
      dataType: i.dataType,
      calculationMethod: i.calculationMethod,
      direction: i.direction,
      unitOfAnalysis: i.unitOfAnalysis,
      version: i.currentVersion,
      provenance: {
        unit: i.unitProvenance,
        dataType: i.dataTypeProvenance,
        calculationMethod: i.calculationProvenance,
        direction: i.directionProvenance,
      },
      flags: i.flags,
      ambiguityNote: i.ambiguityNote,
      relatedCodes: i.relatedCodes,
      sourcePage: i.sourcePage,
    })),
  });
}
