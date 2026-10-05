import 'server-only';

import { prisma } from '@/lib/db';
import { recordAudit, type AuditActor } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Indicator definition versioning.
 *
 * Indicator definitions will evolve across STISA reporting cycles. When they
 * do, historical data must keep the definition it was collected under —
 * otherwise a 2030 re-definition would silently change what a country's 2026
 * figure claims to measure.
 *
 * So definitions are never edited in place once data exists. Instead:
 *   1. the current IndicatorVersion is closed off (`effectiveTo` set),
 *   2. a new version is created,
 *   3. new SubmissionValues pin the new version, old ones keep the old.
 *
 * `sourceText` is deliberately not versionable — it is the verbatim
 * transcription of the printed MEAL Plan and is immutable.
 */

export interface DefinitionPatch {
  officialName?: string;
  definition?: string | null;
  description?: string | null;
  unit?: string;
  dataType?: Prisma.IndicatorUpdateInput['dataType'];
  calculationMethod?: Prisma.IndicatorUpdateInput['calculationMethod'];
  direction?: Prisma.IndicatorUpdateInput['direction'];
  unitOfAnalysis?: Prisma.IndicatorUpdateInput['unitOfAnalysis'];
  required?: boolean;
  sourceRequired?: boolean;
  ambiguityNote?: string | null;
}

export async function createIndicatorVersion(
  actor: AuditActor,
  indicatorId: string,
  patch: DefinitionPatch,
  changeReason: string,
): Promise<{ version: number }> {
  const indicator = await prisma.indicator.findUnique({
    where: { id: indicatorId },
    include: {
      versions: { where: { effectiveTo: null }, orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!indicator) throw new Error('Indicator not found.');

  const current = indicator.versions[0];
  const nextVersion = indicator.currentVersion + 1;
  const now = new Date();

  const merged = {
    officialName: patch.officialName ?? indicator.officialName,
    sourceText: indicator.sourceText, // immutable
    definition: patch.definition !== undefined ? patch.definition : indicator.definition,
    description: patch.description !== undefined ? patch.description : indicator.description,
    unit: patch.unit ?? indicator.unit,
    dataType: (patch.dataType ?? indicator.dataType) as typeof indicator.dataType,
    calculationMethod: (patch.calculationMethod ??
      indicator.calculationMethod) as typeof indicator.calculationMethod,
    direction: (patch.direction ?? indicator.direction) as typeof indicator.direction,
    unitOfAnalysis: (patch.unitOfAnalysis ??
      indicator.unitOfAnalysis) as typeof indicator.unitOfAnalysis,
    flags: indicator.flags,
    ambiguityNote:
      patch.ambiguityNote !== undefined ? patch.ambiguityNote : indicator.ambiguityNote,
    required: patch.required ?? indicator.required,
    sourceRequired: patch.sourceRequired ?? indicator.sourceRequired,
  };

  await prisma.$transaction(async (tx) => {
    if (current) {
      await tx.indicatorVersion.update({
        where: { id: current.id },
        data: { effectiveTo: now },
      });
    }

    await tx.indicatorVersion.create({
      data: {
        indicatorId,
        version: nextVersion,
        ...merged,
        effectiveFrom: now,
        changeReason,
        createdById: actor.id,
      },
    });

    await tx.indicator.update({
      where: { id: indicatorId },
      data: {
        officialName: merged.officialName,
        definition: merged.definition,
        description: merged.description,
        unit: merged.unit,
        dataType: merged.dataType,
        calculationMethod: merged.calculationMethod,
        direction: merged.direction,
        unitOfAnalysis: merged.unitOfAnalysis,
        ambiguityNote: merged.ambiguityNote,
        required: merged.required,
        sourceRequired: merged.sourceRequired,
        currentVersion: nextVersion,
      },
    });
  });

  await recordAudit(actor, {
    action: 'INDICATOR_VERSION_CREATED',
    entity: 'Indicator',
    entityId: indicatorId,
    oldValue: current
      ? {
          version: current.version,
          officialName: current.officialName,
          unit: current.unit,
          dataType: current.dataType,
          calculationMethod: current.calculationMethod,
          direction: current.direction,
          required: current.required,
        }
      : null,
    newValue: { version: nextVersion, ...merged },
    metadata: { indicatorCode: indicator.code, changeReason },
  });

  return { version: nextVersion };
}

/** Whether any submitted data already references this indicator. */
export async function indicatorHasData(indicatorId: string): Promise<boolean> {
  const count = await prisma.submissionValue.count({ where: { indicatorId } });
  return count > 0;
}
