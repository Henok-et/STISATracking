import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { headers } from 'next/headers';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { authConfig } from '@/lib/auth/config';
import {
  consumeAttempt,
  resetAttempts,
  LOGIN_IP_RULE,
  LOGIN_ACCOUNT_RULE,
} from '@/lib/auth/throttle';
import { recordAudit } from '@/lib/audit';

/**
 * A dummy hash of a random string. Verifying against it when an account does
 * not exist keeps the response time of "no such user" and "wrong password"
 * comparable, so the endpoint does not leak which emails are registered.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.ODdcNPnyDLtvGKMYQ0eOZjZBOWyLbfy';

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

/** Surfaces a specific, safe message to the login form. */
class LoginError extends CredentialsSignin {
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    return forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  } catch {
    return 'unknown';
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new LoginError('InvalidCredentials');

        const { email, password } = parsed.data;
        const ip = await clientIp();

        // Two independent buckets: a wide one per IP to blunt spraying, and a
        // tight one per account to blunt targeted guessing.
        const ipCheck = await consumeAttempt(`login:ip:${ip}`, LOGIN_IP_RULE);
        if (!ipCheck.allowed) throw new LoginError('TooManyAttempts');

        const accountCheck = await consumeAttempt(`login:email:${email}`, LOGIN_ACCOUNT_RULE);
        if (!accountCheck.allowed) throw new LoginError('TooManyAttempts');

        const user = await prisma.user.findUnique({
          where: { email },
          include: { country: { select: { id: true, iso2: true, shortName: true, active: true } } },
        });

        // Always run a comparison, even with no user, to equalise timing.
        const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user || !matches) {
          await recordAudit(null, {
            action: 'LOGIN_FAILURE',
            entity: 'User',
            entityId: user?.id ?? null,
            metadata: { email, reason: user ? 'bad_password' : 'unknown_account' },
          });
          throw new LoginError('InvalidCredentials');
        }

        if (!user.active) {
          await recordAudit(null, {
            action: 'LOGIN_FAILURE',
            entity: 'User',
            entityId: user.id,
            metadata: { email, reason: 'account_disabled' },
          });
          throw new LoginError('AccountDisabled');
        }

        // A focal point whose country has been deactivated cannot report.
        if (user.role === 'FOCAL_POINT' && (!user.country || !user.country.active)) {
          await recordAudit(null, {
            action: 'LOGIN_FAILURE',
            entity: 'User',
            entityId: user.id,
            metadata: { email, reason: 'no_active_country_assignment' },
          });
          throw new LoginError('NoCountryAssigned');
        }

        await resetAttempts(`login:email:${email}`);
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
        await recordAudit(
          { id: user.id, email: user.email, role: user.role },
          {
            action: 'LOGIN_SUCCESS',
            entity: 'User',
            entityId: user.id,
            countryId: user.countryId,
          },
        );

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          countryId: user.countryId,
          countryIso2: user.country?.iso2 ?? null,
          countryName: user.country?.shortName ?? null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
