'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/db';
import { requireActor, assertCapability } from '@/lib/auth/guards';
import { createIndicatorVersion, indicatorHasData } from '@/lib/indicators/versioning';
import { recordAudit } from '@/lib/audit';
import { notifyAccountCreated, notifyCycleOpened } from '@/lib/email/notify';
import { ok, fail, guarded, type ActionResult } from './shared';

/**
 * Administrative management actions.
 *
 * Each verifies the capability it needs; none trusts a role name sent from the
 * client. Every mutation writes an audit record with a before/after pair.
 */

// ---------------------------------------------------------------------------
// Users / focal points
// ---------------------------------------------------------------------------

const passwordPolicy = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
    message: 'Password must contain lower case, upper case and a digit.',
  });

const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(255),
    role: z.enum(['ADMIN', 'FOCAL_POINT']),
    countryId: z.string().trim().min(1).nullable().optional(),
    title: z.string().trim().max(200).optional().nullable(),
    organisation: z.string().trim().max(300).optional().nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    password: passwordPolicy,
  })
  .refine((v) => (v.role === 'FOCAL_POINT' ? Boolean(v.countryId) : true), {
    message: 'A focal point must be assigned to a Member State.',
    path: ['countryId'],
  })
  .refine((v) => (v.role === 'ADMIN' ? !v.countryId : true), {
    message: 'Administrators have continental scope and cannot be assigned to a country.',
    path: ['countryId'],
  });

export async function createUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'user:manage');

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) {
      return fail('Please correct the highlighted fields.', 'VALIDATION', flatten(parsed.error));
    }
    const d = parsed.data;

    const clash = await prisma.user.findUnique({ where: { email: d.email } });
    if (clash) return fail('An account with that email already exists.', 'DUPLICATE_EMAIL');

    if (d.countryId) {
      const country = await prisma.country.findUnique({ where: { id: d.countryId } });
      if (!country) return fail('Unknown Member State.', 'BAD_REQUEST');
    }

    const user = await prisma.user.create({
      data: {
        name: d.name,
        email: d.email,
        role: d.role,
        countryId: d.role === 'FOCAL_POINT' ? d.countryId! : null,
        title: d.title ?? null,
        organisation: d.organisation ?? null,
        phone: d.phone ?? null,
        passwordHash: await bcrypt.hash(d.password, 12),
        mustChangePassword: true,
      },
    });

    await recordAudit(actor, {
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      countryId: user.countryId,
      newValue: { email: user.email, role: user.role, countryId: user.countryId },
    });

    const country = user.countryId
      ? await prisma.country.findUnique({
          where: { id: user.countryId },
          select: { shortName: true },
        })
      : null;

    // Deliberately does not carry the temporary password — an administrator
    // shares that through a channel they trust.
    await notifyAccountCreated({
      email: user.email,
      name: user.name,
      role: user.role,
      countryName: country?.shortName ?? null,
    });

    revalidatePath('/admin/users');
    return ok({ id: user.id });
  });
}

const updateUserSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2).max(200).optional(),
  role: z.enum(['ADMIN', 'FOCAL_POINT']).optional(),
  countryId: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional(),
  title: z.string().trim().max(200).nullable().optional(),
  organisation: z.string().trim().max(300).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
});

export async function updateUser(input: unknown): Promise<ActionResult<void>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'user:manage');

    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) {
      return fail('Please correct the highlighted fields.', 'VALIDATION', flatten(parsed.error));
    }
    const { userId, ...patch } = parsed.data;

    const before = await prisma.user.findUnique({ where: { id: userId } });
    if (!before) return fail('User not found.', 'NOT_FOUND');

    // An administrator must not be able to lock themselves out.
    if (before.id === actor.id && patch.active === false) {
      return fail('You cannot deactivate your own account.', 'SELF_LOCKOUT');
    }
    if (before.id === actor.id && patch.role && patch.role !== 'ADMIN') {
      return fail('You cannot remove your own administrator role.', 'SELF_LOCKOUT');
    }

    const role = patch.role ?? before.role;
    const countryId = patch.countryId !== undefined ? patch.countryId : before.countryId;

    if (role === 'FOCAL_POINT' && !countryId) {
      return fail('A focal point must be assigned to a Member State.', 'VALIDATION', {
        countryId: ['A focal point must be assigned to a Member State.'],
      });
    }

    const after = await prisma.user.update({
      where: { id: userId },
      data: {
        ...patch,
        role,
        // Administrators are continental: clearing the country is deliberate.
        countryId: role === 'ADMIN' ? null : countryId,
      },
    });

    await recordAudit(actor, {
      action: patch.active === false ? 'USER_DEACTIVATED' : 'USER_UPDATED',
      entity: 'User',
      entityId: userId,
      countryId: after.countryId,
      oldValue: {
        name: before.name,
        role: before.role,
        countryId: before.countryId,
        active: before.active,
      },
      newValue: { name: after.name, role: after.role, countryId: after.countryId, active: after.active },
    });

    if (before.countryId !== after.countryId) {
      await recordAudit(actor, {
        action: 'USER_COUNTRY_ASSIGNED',
        entity: 'User',
        entityId: userId,
        countryId: after.countryId,
        oldValue: { countryId: before.countryId },
        newValue: { countryId: after.countryId },
      });
    }

    revalidatePath('/admin/users');
    return ok();
  });
}

export async function resetUserPassword(input: unknown): Promise<ActionResult<void>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'user:manage');

    const parsed = z
      .object({ userId: z.string().min(1), password: passwordPolicy })
      .safeParse(input);
    if (!parsed.success) {
      return fail('Please correct the highlighted fields.', 'VALIDATION', flatten(parsed.error));
    }

    const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
    if (!user) return fail('User not found.', 'NOT_FOUND');

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        mustChangePassword: true,
        passwordChangedAt: new Date(),
      },
    });

    await recordAudit(actor, {
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: user.id,
      countryId: user.countryId,
      metadata: { email: user.email },
    });

    revalidatePath('/admin/users');
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Countries
// ---------------------------------------------------------------------------

export async function updateCountry(input: unknown): Promise<ActionResult<void>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'country:manage');

    const parsed = z
      .object({
        countryId: z.string().min(1),
        shortName: z.string().trim().min(2).max(100).optional(),
        regionId: z.string().min(1).optional(),
        active: z.boolean().optional(),
      })
      .safeParse(input);
    if (!parsed.success) return fail('Invalid request payload.', 'BAD_REQUEST');

    const { countryId, ...patch } = parsed.data;
    const before = await prisma.country.findUnique({ where: { id: countryId } });
    if (!before) return fail('Member State not found.', 'NOT_FOUND');

    const after = await prisma.country.update({ where: { id: countryId }, data: patch });

    await recordAudit(actor, {
      action: 'COUNTRY_UPDATED',
      entity: 'Country',
      entityId: countryId,
      countryId,
      oldValue: { shortName: before.shortName, regionId: before.regionId, active: before.active },
      newValue: { shortName: after.shortName, regionId: after.regionId, active: after.active },
    });

    revalidatePath('/admin/countries');
    revalidatePath('/');
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

const indicatorPatchSchema = z.object({
  indicatorId: z.string().min(1),
  changeReason: z.string().trim().min(5).max(1000),
  officialName: z.string().trim().min(3).max(1000).optional(),
  definition: z.string().trim().max(4000).nullable().optional(),
  unit: z.string().trim().min(1).max(200).optional(),
  dataType: z
    .enum(['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY', 'BOOLEAN', 'TEXT', 'URL', 'CATEGORICAL'])
    .optional(),
  calculationMethod: z
    .enum([
      'PERCENTAGE_CHANGE',
      'PERCENTAGE_POINT_CHANGE',
      'ABSOLUTE_COUNT',
      'ABSOLUTE_VALUE',
      'SHARE_OF_TOTAL',
      'INDEX_SCORE',
      'RATIO',
      'BINARY_ACHIEVEMENT',
      'CUSTOM',
      'UNDEFINED',
    ])
    .optional(),
  direction: z
    .enum(['HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_IS_BETTER', 'NOT_APPLICABLE'])
    .optional(),
  required: z.boolean().optional(),
  sourceRequired: z.boolean().optional(),
  ambiguityNote: z.string().trim().max(4000).nullable().optional(),
});

/**
 * Updates an indicator definition.
 *
 * Always creates a new IndicatorVersion rather than editing in place, so values
 * already collected keep the definition they were captured under.
 */
export async function updateIndicatorDefinition(
  input: unknown,
): Promise<ActionResult<{ version: number; hadData: boolean }>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'indicator:manage');

    const parsed = indicatorPatchSchema.safeParse(input);
    if (!parsed.success) {
      return fail('Please correct the highlighted fields.', 'VALIDATION', flatten(parsed.error));
    }

    const { indicatorId, changeReason, ...patch } = parsed.data;
    const hadData = await indicatorHasData(indicatorId);

    const { version } = await createIndicatorVersion(
      { id: actor.id, email: actor.email, role: actor.role },
      indicatorId,
      patch,
      changeReason,
    );

    revalidatePath('/admin/indicators');
    return ok({ version, hadData });
  });
}

export async function setIndicatorActive(input: unknown): Promise<ActionResult<void>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'indicator:manage');

    const parsed = z
      .object({ indicatorId: z.string().min(1), active: z.boolean(), reason: z.string().trim().min(5).max(1000) })
      .safeParse(input);
    if (!parsed.success) return fail('A reason is required.', 'VALIDATION');

    const before = await prisma.indicator.findUnique({ where: { id: parsed.data.indicatorId } });
    if (!before) return fail('Indicator not found.', 'NOT_FOUND');

    await prisma.indicator.update({
      where: { id: parsed.data.indicatorId },
      data: { active: parsed.data.active },
    });

    await recordAudit(actor, {
      action: parsed.data.active ? 'INDICATOR_UPDATED' : 'INDICATOR_DEACTIVATED',
      entity: 'Indicator',
      entityId: before.id,
      oldValue: { active: before.active },
      newValue: { active: parsed.data.active },
      metadata: { indicatorCode: before.code, reason: parsed.data.reason },
    });

    revalidatePath('/admin/indicators');
    return ok();
  });
}

// ---------------------------------------------------------------------------
// Reporting cycles
// ---------------------------------------------------------------------------

const cycleSchema = z.object({
  cycleId: z.string().min(1),
  opensAt: z.coerce.date().optional(),
  closesAt: z.coerce.date().optional(),
  status: z.enum(['PLANNED', 'OPEN', 'CLOSED', 'ARCHIVED']).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export async function updateReportingCycle(input: unknown): Promise<ActionResult<void>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'reportingCycle:manage');

    const parsed = cycleSchema.safeParse(input);
    if (!parsed.success) return fail('Invalid request payload.', 'BAD_REQUEST');

    const { cycleId, ...patch } = parsed.data;
    const before = await prisma.reportingCycle.findUnique({ where: { id: cycleId } });
    if (!before) return fail('Reporting cycle not found.', 'NOT_FOUND');

    const opensAt = patch.opensAt ?? before.opensAt;
    const closesAt = patch.closesAt ?? before.closesAt;
    if (closesAt <= opensAt) {
      return fail('The closing date must be after the opening date.', 'VALIDATION', {
        closesAt: ['The closing date must be after the opening date.'],
      });
    }

    const status = patch.status ?? before.status;

    await prisma.$transaction(async (tx) => {
      // At most one cycle may be open at a time.
      if (status === 'OPEN') {
        await tx.reportingCycle.updateMany({
          where: { id: { not: cycleId }, active: true },
          data: { active: false },
        });
      }
      await tx.reportingCycle.update({
        where: { id: cycleId },
        data: { ...patch, opensAt, closesAt, status, active: status === 'OPEN' },
      });
    });

    await recordAudit(actor, {
      action: 'REPORTING_CYCLE_UPDATED',
      entity: 'ReportingCycle',
      entityId: cycleId,
      oldValue: {
        opensAt: before.opensAt,
        closesAt: before.closesAt,
        status: before.status,
        active: before.active,
      },
      newValue: { opensAt, closesAt, status, active: status === 'OPEN' },
      metadata: { reportingYear: before.reportingYear },
    });

    revalidatePath('/admin/reporting-cycles');
    revalidatePath('/portal');
    return ok();
  });
}

/**
 * Announces an open reporting cycle to every active focal point.
 *
 * Deliberately a separate, explicit action rather than a side effect of opening
 * the cycle: this sends to all 55 Member States, and an accidental duplicate
 * announcement is worse than requiring one extra click.
 */
export async function announceCycle(cycleId: string): Promise<ActionResult<{ sent: number; failed: number }>> {
  return guarded(async () => {
    const actor = await requireActor();
    assertCapability(actor, 'reportingCycle:manage');

    const cycle = await prisma.reportingCycle.findUnique({ where: { id: cycleId } });
    if (!cycle) return fail('Reporting cycle not found.', 'NOT_FOUND');
    if (cycle.status !== 'OPEN') {
      return fail('Only an open reporting cycle can be announced.', 'CYCLE_CLOSED');
    }

    const result = await notifyCycleOpened(cycleId);

    await recordAudit(actor, {
      action: 'REPORTING_CYCLE_UPDATED',
      entity: 'ReportingCycle',
      entityId: cycleId,
      metadata: {
        announcement: true,
        reportingYear: cycle.reportingYear,
        recipients: result.sent,
        failed: result.failed,
      },
    });

    return ok(result);
  });
}

function flatten(error: z.ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
