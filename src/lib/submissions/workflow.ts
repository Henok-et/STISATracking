import type { SubmissionStatus } from '@/generated/prisma/enums';
import type { Capability } from '@/lib/auth/permissions';

/**
 * The submission workflow, expressed as an explicit state machine.
 *
 *   DRAFT ──► SUBMITTED ──► UNDER_REVIEW ──► APPROVED ──► PUBLISHED
 *                               │                            │
 *                               ▼                            │
 *                      REVISION_REQUIRED ──► DRAFT           │
 *                                                            ▼
 *                                                        APPROVED (unpublish)
 *
 * Every transition is declared here with the capability it requires, so no
 * Server Action can invent a shortcut (e.g. DRAFT straight to PUBLISHED).
 */

export type TransitionLabelKey =
  | 'approve'
  | 'beginReview'
  | 'publish'
  | 'reopenReview'
  | 'requestRevisions'
  | 'resubmit'
  | 'resumeEditing'
  | 'submitFinal'
  | 'unlock'
  | 'withdraw';

export interface Transition {
  from: SubmissionStatus;
  to: SubmissionStatus;
  /** Capability the actor must hold. */
  capability: Capability;
  /** Short verb written into audit metadata. Deliberately not translated:
   *  the audit trail is a permanent record, not a UI surface. */
  label: string;
  /** Key into the `transitions` message section, for UI buttons. */
  labelKey: TransitionLabelKey;
  /** Whether the transition requires the reporting cycle to still be open. */
  requiresOpenCycle: boolean;
  /** Whether a full readiness check must pass first. */
  requiresReadiness: boolean;
  /** Whether the actor must supply a note (e.g. what to revise). */
  requiresNote: boolean;
}

export const TRANSITIONS: Transition[] = [
  {
    from: 'DRAFT',
    to: 'SUBMITTED',
    capability: 'submission:submit',
    label: 'Submit final data',
    labelKey: 'submitFinal',
    requiresOpenCycle: true,
    requiresReadiness: true,
    requiresNote: false,
  },
  {
    from: 'REVISION_REQUIRED',
    to: 'SUBMITTED',
    capability: 'submission:submit',
    label: 'Resubmit',
    labelKey: 'resubmit',
    requiresOpenCycle: true,
    requiresReadiness: true,
    requiresNote: false,
  },
  {
    from: 'SUBMITTED',
    to: 'UNDER_REVIEW',
    capability: 'submission:review',
    label: 'Begin review',
    labelKey: 'beginReview',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: false,
  },
  {
    from: 'UNDER_REVIEW',
    to: 'REVISION_REQUIRED',
    capability: 'submission:requestRevision',
    label: 'Request revisions',
    labelKey: 'requestRevisions',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: true,
  },
  {
    from: 'SUBMITTED',
    to: 'REVISION_REQUIRED',
    capability: 'submission:requestRevision',
    label: 'Request revisions',
    labelKey: 'requestRevisions',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: true,
  },
  {
    from: 'UNDER_REVIEW',
    to: 'APPROVED',
    capability: 'submission:approve',
    label: 'Approve',
    labelKey: 'approve',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: false,
  },
  {
    from: 'APPROVED',
    to: 'PUBLISHED',
    capability: 'submission:publish',
    label: 'Publish',
    labelKey: 'publish',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: false,
  },
  {
    from: 'PUBLISHED',
    to: 'APPROVED',
    capability: 'submission:unpublish',
    label: 'Withdraw from public site',
    labelKey: 'withdraw',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: true,
  },
  // Administrative unlock: returns a submission to the focal point for editing.
  {
    from: 'SUBMITTED',
    to: 'DRAFT',
    capability: 'submission:unlock',
    label: 'Unlock for editing',
    labelKey: 'unlock',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: true,
  },
  {
    from: 'UNDER_REVIEW',
    to: 'DRAFT',
    capability: 'submission:unlock',
    label: 'Unlock for editing',
    labelKey: 'unlock',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: true,
  },
  {
    from: 'REVISION_REQUIRED',
    to: 'DRAFT',
    capability: 'submission:editOwnDraft',
    label: 'Resume editing',
    labelKey: 'resumeEditing',
    requiresOpenCycle: true,
    requiresReadiness: false,
    requiresNote: false,
  },
  {
    from: 'APPROVED',
    to: 'UNDER_REVIEW',
    capability: 'submission:unlock',
    label: 'Reopen review',
    labelKey: 'reopenReview',
    requiresOpenCycle: false,
    requiresReadiness: false,
    requiresNote: true,
  },
];

export function findTransition(
  from: SubmissionStatus,
  to: SubmissionStatus,
): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function transitionsFrom(from: SubmissionStatus): Transition[] {
  return TRANSITIONS.filter((t) => t.from === from);
}

/** Statuses whose data may appear on public dashboards. */
export const PUBLIC_STATUSES: SubmissionStatus[] = ['PUBLISHED'];

/**
 * Statuses considered final institutional records. APPROVED data is trusted
 * internally but is NOT public until an administrator publishes it.
 */
export const APPROVED_STATUSES: SubmissionStatus[] = ['APPROVED', 'PUBLISHED'];

/** Statuses a focal point may still edit. */
export const EDITABLE_STATUSES: SubmissionStatus[] = ['DRAFT', 'REVISION_REQUIRED'];

export function isPublic(status: SubmissionStatus): boolean {
  return PUBLIC_STATUSES.includes(status);
}

export function isEditable(status: SubmissionStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export const STATUS_LABELS: Record<SubmissionStatus | 'NOT_STARTED', string> = {
  NOT_STARTED: 'Not started',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  REVISION_REQUIRED: 'Revision required',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
};

/** Ordered for progress indicators and admin filters. */
export const STATUS_ORDER: (SubmissionStatus | 'NOT_STARTED')[] = [
  'NOT_STARTED',
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
  'PUBLISHED',
];
