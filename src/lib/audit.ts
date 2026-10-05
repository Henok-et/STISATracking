import 'server-only';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import type { AuditAction, UserRole } from '@/generated/prisma/enums';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Append-only audit trail.
 *
 * The trail must be able to answer: who changed this indicator value, what was
 * it before, what is it now, and when. Actor email and role are denormalised so
 * the record stays meaningful even if the user is later removed.
 */

export interface AuditActor {
  id: string;
  email: string;
  role: UserRole;
}

export interface AuditEntry {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  countryId?: string | null;
  submissionId?: string | null;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
}

async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    return {
      ipAddress: forwarded ? forwarded.split(',')[0]!.trim() : h.get('x-real-ip'),
      userAgent: h.get('user-agent'),
    };
  } catch {
    // Called outside a request scope (e.g. from a script).
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Writes one audit record.
 *
 * Never throws: an audit failure must not roll back or block the user-facing
 * operation that succeeded. Failures are logged loudly for operators.
 */
export async function recordAudit(actor: AuditActor | null, entry: AuditEntry): Promise<void> {
  try {
    const { ipAddress, userAgent } = await requestContext();
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        userId: actor?.id ?? null,
        actorEmail: actor?.email ?? null,
        actorRole: actor?.role ?? null,
        countryId: entry.countryId ?? null,
        submissionId: entry.submissionId ?? null,
        oldValue: entry.oldValue ?? undefined,
        newValue: entry.newValue ?? undefined,
        metadata: entry.metadata ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    console.error('[audit] failed to write audit record', { entry, error });
  }
}

/**
 * Convenience wrapper for value-level changes, which are the trail's most
 * important records: it captures the before/after pair explicitly.
 */
export async function recordValueChange(
  actor: AuditActor,
  params: {
    submissionId: string;
    countryId: string;
    indicatorCode: string;
    valueId: string;
    before: Prisma.InputJsonValue | null;
    after: Prisma.InputJsonValue;
  },
): Promise<void> {
  await recordAudit(actor, {
    action: 'SUBMISSION_VALUE_CHANGED',
    entity: 'SubmissionValue',
    entityId: params.valueId,
    countryId: params.countryId,
    submissionId: params.submissionId,
    oldValue: params.before,
    newValue: params.after,
    metadata: { indicatorCode: params.indicatorCode },
  });
}
