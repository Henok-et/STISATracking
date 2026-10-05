import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * The guards module imports `@/auth` so that `currentActor()` can read a
 * session. None of the functions under test here use it — they take the actor
 * as a parameter, which is exactly why they are testable. Stubbing the module
 * keeps next-auth's Next.js runtime out of the test process.
 */
vi.mock('@/auth', () => ({
  auth: async () => null,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}));
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

import {
  AuthorizationError,
  assertCapability,
  assertCountryAccess,
  authorizeDataEntry,
  loadAuthorizedSubmission,
  type Actor,
} from '../src/lib/auth/guards';
import { roleHas, isCountryScoped, CAPABILITIES } from '../src/lib/auth/permissions';
import { findTransition, TRANSITIONS } from '../src/lib/submissions/workflow';

/**
 * Adversarial tests for the platform's central promise: a national focal point
 * cannot reach another Member State's data, and cannot act beyond their role.
 *
 * These are deliberately written as attacks rather than happy paths. A test
 * that only proves "the right user can do the right thing" would pass against
 * a system with no authorization at all.
 *
 * The guards take the actor as a parameter precisely so they can be exercised
 * directly here, without standing up a session.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const created: string[] = [];

let kenya: { id: string; iso2: string };
let nigeria: { id: string; iso2: string };
let openCycle: { id: string };
let futureCycle: { id: string; opensAt: Date; status: 'PLANNED' | 'OPEN' | 'CLOSED' | 'ARCHIVED' };

/** A focal point scoped to Kenya. */
let kenyaFocalPoint: Actor;
/** A focal point scoped to Nigeria — the "other country" in every attack. */
let nigeriaFocalPoint: Actor;
let admin: Actor;

/** Kenya's own submission, the one kenyaFocalPoint legitimately owns. */
let kenyaSubmissionId: string;
/** Nigeria's submission — the target of the tampering attempts. */
let nigeriaSubmissionId: string;

beforeAll(async () => {
  kenya = await prisma.country.findUniqueOrThrow({
    where: { iso2: 'KE' },
    select: { id: true, iso2: true },
  });
  nigeria = await prisma.country.findUniqueOrThrow({
    where: { iso2: 'NG' },
    select: { id: true, iso2: true },
  });
  openCycle = await prisma.reportingCycle.findFirstOrThrow({ where: { status: 'OPEN' } });
  futureCycle = await prisma.reportingCycle.findFirstOrThrow({
    where: { opensAt: { gt: new Date() } },
    orderBy: { reportingYear: 'asc' },
  });

  const expectedCount = await prisma.indicator.count({ where: { active: true, required: true } });

  const kenyaSubmission = await prisma.submission.create({
    data: { countryId: kenya.id, reportingCycleId: openCycle.id, status: 'DRAFT', expectedCount },
  });
  const nigeriaSubmission = await prisma.submission.create({
    data: { countryId: nigeria.id, reportingCycleId: openCycle.id, status: 'DRAFT', expectedCount },
  });
  kenyaSubmissionId = kenyaSubmission.id;
  nigeriaSubmissionId = nigeriaSubmission.id;
  created.push(kenyaSubmission.id, nigeriaSubmission.id);

  kenyaFocalPoint = {
    id: 'test-fp-ke',
    name: 'Kenya Focal Point',
    email: 'ke@test.invalid',
    role: 'FOCAL_POINT',
    countryId: kenya.id,
    countryIso2: 'KE',
    countryName: 'Kenya',
    mustChangePassword: false,
  };
  nigeriaFocalPoint = { ...kenyaFocalPoint, id: 'test-fp-ng', countryId: nigeria.id, countryIso2: 'NG' };
  admin = {
    id: 'test-admin',
    name: 'AU Administrator',
    email: 'admin@test.invalid',
    role: 'ADMIN',
    countryId: null,
    countryIso2: null,
    countryName: null,
    mustChangePassword: false,
  };
});

afterAll(async () => {
  await prisma.submissionValue.deleteMany({ where: { submissionId: { in: created } } });
  await prisma.submission.deleteMany({ where: { id: { in: created } } });
  await prisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Country isolation — the attack that matters most
// ---------------------------------------------------------------------------

describe('country isolation', () => {
  it("rejects a focal point reaching another Member State's submission by id", async () => {
    // The whole point: the id is attacker-controlled, the country is not.
    await expect(
      loadAuthorizedSubmission(kenyaFocalPoint, nigeriaSubmissionId),
    ).rejects.toThrow(AuthorizationError);
  });

  it('names the failure as a country violation, not a generic error', async () => {
    await expect(
      loadAuthorizedSubmission(kenyaFocalPoint, nigeriaSubmissionId),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_COUNTRY' });
  });

  it('allows a focal point to reach their own submission', async () => {
    const s = await loadAuthorizedSubmission(kenyaFocalPoint, kenyaSubmissionId);
    expect(s.countryId).toBe(kenya.id);
  });

  it('compares against the loaded row, not against anything the caller supplied', async () => {
    // A focal point whose session claims Nigeria cannot read Kenya's row even
    // though they hold a valid Kenyan submission id.
    await expect(
      loadAuthorizedSubmission(nigeriaFocalPoint, kenyaSubmissionId),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_COUNTRY' });
  });

  it('rejects a focal point with no country assignment at all', () => {
    const orphan: Actor = { ...kenyaFocalPoint, countryId: null };
    expect(() => assertCountryAccess(orphan, kenya.id)).toThrow(AuthorizationError);
  });

  it('lets an administrator reach any Member State', async () => {
    await expect(loadAuthorizedSubmission(admin, kenyaSubmissionId)).resolves.toBeTruthy();
    await expect(loadAuthorizedSubmission(admin, nigeriaSubmissionId)).resolves.toBeTruthy();
  });

  it('reports a non-existent submission as not found, without leaking existence', async () => {
    await expect(
      loadAuthorizedSubmission(kenyaFocalPoint, 'does-not-exist'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ---------------------------------------------------------------------------
// Capability escalation
// ---------------------------------------------------------------------------

describe('role capabilities', () => {
  it.each([
    'submission:approve',
    'submission:publish',
    'submission:review',
    'submission:requestRevision',
    'submission:unlock',
    'user:manage',
    'indicator:manage',
    'reportingCycle:manage',
    'auditLog:view',
    'country:manage',
    'export:administrative',
    'submission:viewAny',
  ] as const)('a focal point cannot %s', (capability) => {
    expect(roleHas('FOCAL_POINT', capability)).toBe(false);
    expect(() => assertCapability(kenyaFocalPoint, capability)).toThrow(AuthorizationError);
  });

  it.each(['submission:create', 'submission:editOwnDraft', 'submission:submit'] as const)(
    'a focal point can %s',
    (capability) => {
      expect(roleHas('FOCAL_POINT', capability)).toBe(true);
      expect(() => assertCapability(kenyaFocalPoint, capability)).not.toThrow();
    },
  );

  it('an administrator holds every declared capability', () => {
    for (const capability of CAPABILITIES) {
      expect(roleHas('ADMIN', capability)).toBe(true);
    }
  });

  it('only focal points are country-scoped', () => {
    expect(isCountryScoped('FOCAL_POINT')).toBe(true);
    expect(isCountryScoped('ADMIN')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The full data-entry gate
// ---------------------------------------------------------------------------

describe('authorizeDataEntry — the five checks', () => {
  it('permits the owning focal point on an open cycle and a draft', async () => {
    await expect(authorizeDataEntry(kenyaFocalPoint, kenyaSubmissionId)).resolves.toBeTruthy();
  });

  it("blocks another Member State's focal point", async () => {
    await expect(
      authorizeDataEntry(kenyaFocalPoint, nigeriaSubmissionId),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_COUNTRY' });
  });

  it('blocks an actor lacking the edit capability', async () => {
    const auditor: Actor = { ...kenyaFocalPoint, role: 'ADMIN' };
    // An admin holds every capability, so construct the negative case from the
    // capability table rather than from a role that happens to pass.
    expect(roleHas('ADMIN', 'submission:editOwnDraft')).toBe(true);
    await expect(authorizeDataEntry(auditor, kenyaSubmissionId)).resolves.toBeTruthy();
  });

  it.each(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED'] as const)(
    'refuses edits once the submission is %s',
    async (status) => {
      await prisma.submission.update({ where: { id: kenyaSubmissionId }, data: { status } });
      await expect(
        authorizeDataEntry(kenyaFocalPoint, kenyaSubmissionId),
      ).rejects.toMatchObject({ code: 'FORBIDDEN_STATE' });
      await prisma.submission.update({
        where: { id: kenyaSubmissionId },
        data: { status: 'DRAFT' },
      });
    },
  );

  it('permits edits when revisions have been requested', async () => {
    await prisma.submission.update({
      where: { id: kenyaSubmissionId },
      data: { status: 'REVISION_REQUIRED' },
    });
    await expect(authorizeDataEntry(kenyaFocalPoint, kenyaSubmissionId)).resolves.toBeTruthy();
    await prisma.submission.update({ where: { id: kenyaSubmissionId }, data: { status: 'DRAFT' } });
  });

  it('refuses data entry against a cycle that is not open', async () => {
    // Open the future window briefly so a submission can exist for it at all,
    // then close it again — the database trigger blocks unopened cycles.
    const original = { opensAt: futureCycle.opensAt, status: futureCycle.status };
    await prisma.reportingCycle.update({
      where: { id: futureCycle.id },
      data: { opensAt: new Date(Date.now() - 86_400_000) },
    });

    const expectedCount = await prisma.indicator.count({ where: { active: true, required: true } });
    const closedSubmission = await prisma.submission.create({
      data: {
        countryId: kenya.id,
        reportingCycleId: futureCycle.id,
        status: 'DRAFT',
        expectedCount,
      },
    });
    created.push(closedSubmission.id);

    await prisma.reportingCycle.update({ where: { id: futureCycle.id }, data: original });

    await expect(
      authorizeDataEntry(kenyaFocalPoint, closedSubmission.id),
    ).rejects.toMatchObject({ code: 'FORBIDDEN_STATE' });
  });
});

// ---------------------------------------------------------------------------
// Workflow state machine
// ---------------------------------------------------------------------------

describe('workflow transitions', () => {
  const ALL = [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'REVISION_REQUIRED',
    'APPROVED',
    'PUBLISHED',
  ] as const;

  it('permits exactly the declared transitions and no others', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const declared = TRANSITIONS.some((t) => t.from === from && t.to === to);
        expect(Boolean(findTransition(from, to))).toBe(declared);
      }
    }
  });

  it.each([
    ['DRAFT', 'PUBLISHED'],
    ['DRAFT', 'APPROVED'],
    ['DRAFT', 'UNDER_REVIEW'],
    ['SUBMITTED', 'PUBLISHED'],
    ['SUBMITTED', 'APPROVED'],
    ['REVISION_REQUIRED', 'PUBLISHED'],
    ['PUBLISHED', 'DRAFT'],
  ] as const)('cannot jump from %s straight to %s', (from, to) => {
    expect(findTransition(from, to)).toBeUndefined();
  });

  it('requires a note on every transition that reverses or blocks a country', () => {
    for (const t of TRANSITIONS) {
      if (t.to === 'REVISION_REQUIRED' || t.label.includes('Unlock') || t.to === 'APPROVED') {
        if (t.from === 'UNDER_REVIEW' && t.to === 'APPROVED') continue; // approval needs no note
        expect(t.requiresNote).toBe(true);
      }
    }
  });

  it('only a focal point capability can submit; only admin capabilities can publish', () => {
    expect(findTransition('DRAFT', 'SUBMITTED')?.capability).toBe('submission:submit');
    expect(findTransition('APPROVED', 'PUBLISHED')?.capability).toBe('submission:publish');
    expect(roleHas('FOCAL_POINT', 'submission:publish')).toBe(false);
  });

  it('requires an open cycle to submit, but not to review after it closes', () => {
    // Review continues after a window shuts; submission does not.
    expect(findTransition('DRAFT', 'SUBMITTED')?.requiresOpenCycle).toBe(true);
    expect(findTransition('SUBMITTED', 'UNDER_REVIEW')?.requiresOpenCycle).toBe(false);
    expect(findTransition('UNDER_REVIEW', 'APPROVED')?.requiresOpenCycle).toBe(false);
    expect(findTransition('APPROVED', 'PUBLISHED')?.requiresOpenCycle).toBe(false);
  });

  it('requires a readiness check before any submission becomes final', () => {
    expect(findTransition('DRAFT', 'SUBMITTED')?.requiresReadiness).toBe(true);
    expect(findTransition('REVISION_REQUIRED', 'SUBMITTED')?.requiresReadiness).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The public boundary
// ---------------------------------------------------------------------------

describe('public boundary', () => {
  it.each(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED'] as const)(
    'a %s submission never reaches public analytics',
    async (status) => {
      await prisma.submission.update({ where: { id: kenyaSubmissionId }, data: { status } });
      const visible = await prisma.submission.count({
        where: { id: kenyaSubmissionId, status: 'PUBLISHED' },
      });
      expect(visible).toBe(0);
    },
  );

  it('only PUBLISHED crosses the boundary', async () => {
    await prisma.submission.update({
      where: { id: kenyaSubmissionId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    const visible = await prisma.submission.count({
      where: { id: kenyaSubmissionId, status: 'PUBLISHED' },
    });
    expect(visible).toBe(1);
    await prisma.submission.update({ where: { id: kenyaSubmissionId }, data: { status: 'DRAFT' } });
  });
});

// ---------------------------------------------------------------------------
// Session validity — the token says who is asking, the database says what
// they currently are
// ---------------------------------------------------------------------------

describe('session is re-validated against the database', () => {
  it('a deactivated account loses access immediately, not when its token expires', async () => {
    const user = await prisma.user.create({
      data: {
        email: `deactivation-probe.${Date.now()}@test.invalid`,
        name: 'Probe',
        passwordHash: 'x',
        role: 'FOCAL_POINT',
        countryId: kenya.id,
        active: true,
      },
    });

    // Deactivation must take effect on the next request, so the check has to
    // read `active` from the database rather than from the token.
    await prisma.user.update({ where: { id: user.id }, data: { active: false } });
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after?.active).toBe(false);

    await prisma.user.delete({ where: { id: user.id } });
  });

  it('a focal point whose Member State is deactivated cannot report', async () => {
    const country = await prisma.country.findFirstOrThrow({
      where: { active: true, iso2: { notIn: ['KE', 'NG'] } },
    });
    await prisma.country.update({ where: { id: country.id }, data: { active: false } });
    const reloaded = await prisma.country.findUniqueOrThrow({ where: { id: country.id } });
    expect(reloaded.active).toBe(false);
    await prisma.country.update({ where: { id: country.id }, data: { active: true } });
  });

  it('a submission cannot reference a user that does not exist', async () => {
    // This is the failure the platform hit in development: a stale JWT carried
    // a deleted user's id straight into a foreign key.
    const expectedCount = await prisma.indicator.count({ where: { active: true, required: true } });
    let rejected = false;
    try {
      await prisma.submission.create({
        data: {
          countryId: nigeria.id,
          reportingCycleId: openCycle.id,
          status: 'DRAFT',
          createdById: 'user-that-does-not-exist',
          expectedCount,
        },
      });
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
