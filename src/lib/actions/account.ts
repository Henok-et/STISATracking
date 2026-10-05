'use server';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn, signOut } from '@/auth';
import { prisma } from '@/lib/db';
import { requireActor } from '@/lib/auth/guards';
import { recordAudit } from '@/lib/audit';
import { checkRateLimit } from '@/lib/auth/rate-limit';
import { ok, fail, guarded, type ActionResult } from './shared';

/** Messages are deliberately generic so the form cannot be used to enumerate accounts. */
const LOGIN_MESSAGES: Record<string, string> = {
  InvalidCredentials: 'Incorrect email or password.',
  AccountDisabled: 'This account has been deactivated. Contact the AU STISA administrator.',
  NoCountryAssigned:
    'No active Member State is assigned to your account. Contact the AU STISA administrator.',
  TooManyAttempts: 'Too many sign-in attempts. Please wait 15 minutes and try again.',
};

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(255),
  password: z.string().min(1, 'Enter your password.'),
  callbackUrl: z.string().optional(),
});

export async function login(_prev: unknown, formData: FormData): Promise<ActionResult<void>> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    callbackUrl: formData.get('callbackUrl') ?? undefined,
  });

  if (!parsed.success) {
    return fail('Enter your email address and password.', 'VALIDATION');
  }

  const rateLimit = checkRateLimit(`login:${parsed.data.email}`, { limit: 5, windowMs: 60000 });
  if (!rateLimit.success) {
    return fail(LOGIN_MESSAGES.TooManyAttempts, 'TooManyAttempts');
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = (error as AuthError & { code?: string }).code ?? 'InvalidCredentials';
      return fail(LOGIN_MESSAGES[code] ?? LOGIN_MESSAGES.InvalidCredentials!, code);
    }
    throw error;
  }

  // Only redirect to same-origin paths — never to a URL supplied by a caller.
  const target = safeRedirectTarget(parsed.data.callbackUrl);
  redirect(target);
}

function safeRedirectTarget(candidate: string | undefined): string {
  if (!candidate) return '/portal';
  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/portal';
  return candidate;
}

export async function logout(): Promise<void> {
  const actor = await requireActor().catch(() => null);
  if (actor) {
    await recordAudit(actor, {
      action: 'LOGOUT',
      entity: 'User',
      entityId: actor.id,
      countryId: actor.countryId,
    });
  }
  await signOut({ redirectTo: '/portal/login' });
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: z
      .string()
      .min(12, 'New password must be at least 12 characters.')
      .max(200)
      .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
        message: 'Include lower case, upper case and a digit.',
      }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Choose a password different from your current one.',
    path: ['newPassword'],
  });

export async function changePassword(input: unknown): Promise<ActionResult<void>> {
  return guarded(async () => {
    const actor = await requireActor();

    const rateLimit = checkRateLimit(`changePassword:${actor.id}`, { limit: 3, windowMs: 60000 });
    if (!rateLimit.success) {
      return fail('Too many attempts. Please try again later.', 'RATE_LIMITED');
    }

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_';
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return fail('Please correct the highlighted fields.', 'VALIDATION', fieldErrors);
    }

    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user) return fail('Account not found.', 'NOT_FOUND');

    const matches = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!matches) {
      return fail('Your current password is incorrect.', 'VALIDATION', {
        currentPassword: ['Your current password is incorrect.'],
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(parsed.data.newPassword, 12),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    await recordAudit(actor, {
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: user.id,
      countryId: user.countryId,
      metadata: { selfService: true },
    });

    return ok();
  });
}
