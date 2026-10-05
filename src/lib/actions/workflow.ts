'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import {
  requireActor,
  assertCapability,
  assertCountryAccess,
  AuthorizationError,
} from '@/lib/auth/guards';
import { findTransition } from '@/lib/submissions/workflow';
import { evaluateReadiness, refreshCompleteness } from '@/lib/submissions/readiness';
import { isCycleOpen } from '@/lib/reporting/cycles';
import { recordAudit } from '@/lib/audit';
import { notifyTransition } from '@/lib/email/notify';
import { ok, fail, guarded, type ActionResult } from './shared';
import type { AuditAction, SubmissionStatus } from '@/generated/prisma/enums';

/**
 * Workflow transitions.
 *
 * All state changes funnel through one action so the state machine in
 * lib/submissions/workflow.ts is the single authority on what is legal. There
 * is no code path that can set `status` directly.
 */

const transitionSchema = z.object({
  submissionId: z.string().min(1),
  to: z.enum([
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'REVISION_REQUIRED',
    'APPROVED',
    'PUBLISHED',
  ]),
  note: z.string().trim().max(4000).optional(),
});

const AUDIT_FOR_TRANSITION: Record<string, AuditAction> = {
  'DRAFT->SUBMITTED': 'SUBMISSION_SUBMITTED',
  'REVISION_REQUIRED->SUBMITTED': 'SUBMISSION_SUBMITTED',
  'SUBMITTED->UNDER_REVIEW': 'SUBMISSION_REVIEW_STARTED',
  'UNDER_REVIEW->REVISION_REQUIRED': 'SUBMISSION_REVISION_REQUESTED',
  'SUBMITTED->REVISION_REQUIRED': 'SUBMISSION_REVISION_REQUESTED',
  'UNDER_REVIEW->APPROVED': 'SUBMISSION_APPROVED',
  'APPROVED->PUBLISHED': 'SUBMISSION_PUBLISHED',
  'PUBLISHED->APPROVED': 'SUBMISSION_UNPUBLISHED',
  'SUBMITTED->DRAFT': 'SUBMISSION_UNLOCKED',
  'UNDER_REVIEW->DRAFT': 'SUBMISSION_UNLOCKED',
  'APPROVED->UNDER_REVIEW': 'SUBMISSION_UNLOCKED',
  'REVISION_REQUIRED->DRAFT': 'SUBMISSION_UNLOCKED',
};

export interface TransitionResult {
  status: SubmissionStatus;
  /** Populated when a readiness check blocked the transition. */
  blockingIssues?: { indicatorCode: string; indicatorName: string; message: string }[];
}

export async function transitionSubmission(
  input: unknown,
): Promise<ActionResult<TransitionResult>> {
  return guarded(async () => {
    const parsed = transitionSchema.safeParse(input);
    if (!parsed.success) return fail('Invalid request payload.', 'BAD_REQUEST');

    const { submissionId, to, note } = parsed.data;
    const actor = await requireActor();

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { reportingCycle: true, country: { select: { shortName: true } } },
    });
    if (!submission) return fail('Submission not found.', 'NOT_FOUND');

    // Country scoping applies to focal points on every transition they attempt.
    assertCountryAccess(actor, submission.countryId);

    const transition = findTransition(submission.status, to);
    if (!transition) {
      return fail(
        `A submission cannot move from ${submission.status} to ${to}.`,
        'ILLEGAL_TRANSITION',
      );
    }

    assertCapability(actor, transition.capability);

    if (transition.requiresNote && !note) {
      return fail('A note explaining this action is required.', 'NOTE_REQUIRED');
    }

    if (transition.requiresOpenCycle && !isCycleOpen(submission.reportingCycle)) {
      return fail(
        `The ${submission.reportingCycle.label} is closed. ${transition.label} is no longer possible.`,
        'CYCLE_CLOSED',
      );
    }

    if (transition.requiresReadiness) {
      const readiness = await evaluateReadiness(submissionId);
      if (!readiness.ready) {
        return ok({
          status: submission.status,
          blockingIssues: readiness.issues.map((i) => ({
            indicatorCode: i.indicatorCode,
            indicatorName: i.indicatorName,
            message: i.message,
          })),
        });
      }
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: to };

    switch (`${submission.status}->${to}`) {
      case 'DRAFT->SUBMITTED':
      case 'REVISION_REQUIRED->SUBMITTED':
        data.submittedAt = now;
        data.submittedById = actor.id;
        break;
      case 'SUBMITTED->UNDER_REVIEW':
        data.reviewedAt = now;
        data.reviewedById = actor.id;
        break;
      case 'UNDER_REVIEW->REVISION_REQUIRED':
      case 'SUBMITTED->REVISION_REQUIRED':
        data.revisionRequestedAt = now;
        data.revisionRequestedById = actor.id;
        data.revisionNote = note ?? null;
        break;
      case 'UNDER_REVIEW->APPROVED':
        data.approvedAt = now;
        data.approvedById = actor.id;
        break;
      case 'APPROVED->PUBLISHED':
        data.publishedAt = now;
        data.publishedById = actor.id;
        break;
      case 'PUBLISHED->APPROVED':
        // Withdrawing from the public site clears the publication stamp so the
        // record cannot look published while being absent from public analytics.
        data.publishedAt = null;
        data.publishedById = null;
        break;
      default:
        break;
    }

    const updated = await prisma.submission.update({ where: { id: submissionId }, data });
    await refreshCompleteness(submissionId);

    await recordAudit(actor, {
      action: AUDIT_FOR_TRANSITION[`${submission.status}->${to}`] ?? 'SUBMISSION_UNLOCKED',
      entity: 'Submission',
      entityId: submissionId,
      countryId: submission.countryId,
      submissionId,
      oldValue: { status: submission.status },
      newValue: { status: to },
      metadata: {
        transition: transition.label,
        note: note ?? null,
        country: submission.country.shortName,
        reportingYear: submission.reportingCycle.reportingYear,
      },
    });

    // Email is a courtesy layered on top of the record, never part of it: the
    // transition is already committed and audited above, so a mail outage
    // cannot undo an approval. notifyTransition swallows its own errors.
    await notifyTransition({
      submissionId,
      from: submission.status,
      to,
      note: note ?? null,
      actorName: actor.name,
    });

    revalidatePath('/portal');
    revalidatePath('/portal/data-entry');
    revalidatePath('/admin/overview');
    revalidatePath('/admin/submissions');
    // Publication and withdrawal change what the public sees.
    if (to === 'PUBLISHED' || submission.status === 'PUBLISHED') {
      revalidatePath('/');
      revalidatePath('/countries', 'layout');
      revalidatePath('/sectors', 'layout');
    }

    return ok({ status: updated.status });
  });
}

/**
 * Bulk publish for administrators — used at the end of a review round.
 * Each submission is still validated individually against the state machine.
 */
export async function publishMany(submissionIds: string[]): Promise<ActionResult<{ published: number; skipped: number }>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'submission:publish');

    const ids = z.array(z.string().min(1)).max(200).parse(submissionIds);
    let published = 0;
    let skipped = 0;

    for (const id of ids) {
      const result = await transitionSubmission({ submissionId: id, to: 'PUBLISHED' });
      if (result.ok) published++;
      else skipped++;
    }

    revalidatePath('/admin/submissions');
    revalidatePath('/');
    return ok({ published, skipped });
  });
}

/** Loads a submission for administrative review, enforcing continental scope. */
export async function loadSubmissionForReview(submissionId: string) {
  const actor = await requireActor();
  assertCapability(actor, 'submission:viewAny');

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      country: { include: { region: true } },
      reportingCycle: true,
      values: { include: { indicator: { include: { sector: true } } } },
    },
  });

  if (!submission) throw new AuthorizationError('Submission not found.', 'NOT_FOUND');
  return submission;
}
