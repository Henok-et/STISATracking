import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { roleHas, isCountryScoped, type Capability } from './permissions';
import type { UserRole } from '@/generated/prisma/enums';

/**
 * Server-side authorization guards.
 *
 * EVERY mutation and every non-public read must pass through these. Client-side
 * checks exist only to hide controls; they are never the enforcement point.
 *
 * The core invariant these guards protect: a focal point cannot reach another
 * country's data by editing an id in a request payload. Guards never trust an
 * id from the client — they re-read the target row from the database and
 * compare its ownership against the *session*.
 */

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN_ROLE'
      | 'FORBIDDEN_COUNTRY'
      | 'FORBIDDEN_STATE'
      | 'NOT_FOUND' = 'FORBIDDEN_ROLE',
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  countryId: string | null;
  countryIso2: string | null;
  countryName: string | null;
  mustChangePassword: boolean;
}

/** Returns the current actor, or null when unauthenticated. */
export const currentActor = cache(async (): Promise<Actor | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;

  /*
   * The session is a JWT, so it keeps asserting whatever was true when it was
   * issued — for up to eight hours. Trusting it outright means:
   *
   *   - a DEACTIVATED account keeps full access until the token expires, which
   *     defeats the point of the admin being able to deactivate it;
   *   - a role or Member State reassignment does not take effect until the
   *     user next signs in;
   *   - a DELETED user's id is still used as a foreign key, which fails at the
   *     database rather than at the door.
   *
   * So the token establishes WHO is asking, and the database decides what they
   * currently are. One primary-key lookup, deduplicated per request by cache().
   */
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { country: { select: { id: true, iso2: true, shortName: true, active: true } } },
  });

  if (!user || !user.active) return null;

  // A focal point whose Member State has been deactivated cannot report.
  if (user.role === 'FOCAL_POINT' && (!user.country || !user.country.active)) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    // Role and country come from the database, not the token, so a change
    // takes effect on the very next request.
    role: user.role,
    countryId: user.countryId,
    countryIso2: user.country?.iso2 ?? null,
    countryName: user.country?.shortName ?? null,
    mustChangePassword: user.mustChangePassword,
  };
});

/**
 * Throws unless authenticated. Use inside Server Actions, where an exception is
 * the right outcome. Pages should use `requireActorOrRedirect`.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new AuthorizationError('Authentication required.', 'UNAUTHENTICATED');
  return actor;
}

/** Page-level equivalent: sends unauthenticated visitors to the login screen. */
export async function requireActorOrRedirect(returnTo?: string): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) {
    const target = returnTo ? `/portal/login?callbackUrl=${encodeURIComponent(returnTo)}` : '/portal/login';
    redirect(target);
  }
  return actor;
}

/** Throws unless the actor's role carries `capability`. */
export function assertCapability(actor: Actor, capability: Capability): void {
  if (!roleHas(actor.role, capability)) {
    throw new AuthorizationError(
      `Your role does not permit this action (${capability}).`,
      'FORBIDDEN_ROLE',
    );
  }
}

export async function requireCapability(capability: Capability): Promise<Actor> {
  const actor = await requireActor();
  assertCapability(actor, capability);
  return actor;
}

export async function requireAdminOrRedirect(returnTo?: string): Promise<Actor> {
  const actor = await requireActorOrRedirect(returnTo);
  if (!roleHas(actor.role, 'submission:viewAny')) redirect('/portal');
  return actor;
}

/**
 * Throws unless the actor may act on `countryId`.
 *
 * Country-scoped actors (focal points) are confined to their assigned Member
 * State. Actors with continental scope (administrators) pass.
 */
export function assertCountryAccess(actor: Actor, countryId: string): void {
  if (!isCountryScoped(actor.role)) return;
  if (!actor.countryId) {
    throw new AuthorizationError('No Member State is assigned to your account.', 'FORBIDDEN_COUNTRY');
  }
  if (actor.countryId !== countryId) {
    throw new AuthorizationError(
      'You may only access data for your assigned Member State.',
      'FORBIDDEN_COUNTRY',
    );
  }
}

/**
 * Loads a submission and authorizes the actor against it in one step.
 *
 * This is the guard that makes id tampering impossible: the countryId compared
 * against the session comes from the freshly-read submission row, never from
 * the client.
 */
export async function loadAuthorizedSubmission(actor: Actor, submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      country: { select: { id: true, iso2: true, shortName: true, name: true, active: true } },
      reportingCycle: true,
    },
  });

  if (!submission) throw new AuthorizationError('Submission not found.', 'NOT_FOUND');

  assertCountryAccess(actor, submission.countryId);
  return submission;
}

/**
 * Full mutation gate for focal point data entry.
 *
 * Verifies, in order: authenticated user, authorized role, authorized country,
 * authorized submission, and authorized reporting cycle. All five must hold
 * before any write is permitted.
 */
export async function authorizeDataEntry(actor: Actor, submissionId: string) {
  assertCapability(actor, 'submission:editOwnDraft');

  const submission = await loadAuthorizedSubmission(actor, submissionId);

  // Reporting cycle must be open. A closed cycle is closed for everyone —
  // historical data is never editable in place.
  const now = new Date();
  const cycle = submission.reportingCycle;
  const cycleOpen =
    cycle.status === 'OPEN' && cycle.opensAt <= now && cycle.closesAt >= now;

  if (!cycleOpen) {
    throw new AuthorizationError(
      `The ${cycle.label} is not open for data entry.`,
      'FORBIDDEN_STATE',
    );
  }

  // Only DRAFT and REVISION_REQUIRED submissions accept focal point edits.
  if (submission.status !== 'DRAFT' && submission.status !== 'REVISION_REQUIRED') {
    throw new AuthorizationError(
      `This submission is ${submission.status.toLowerCase().replace('_', ' ')} and can no longer be edited.`,
      'FORBIDDEN_STATE',
    );
  }

  return submission;
}
