import 'server-only';

import { prisma } from '@/lib/db';

/**
 * Database-backed fixed-window rate limiting for authentication-sensitive
 * endpoints. Backed by Postgres rather than process memory so limits hold
 * across server instances and restarts.
 */

export interface ThrottleRule {
  /** Maximum attempts allowed inside one window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** How long to lock the bucket once the limit is exceeded. */
  blockMs: number;
}

export const LOGIN_IP_RULE: ThrottleRule = {
  limit: 20,
  windowMs: 15 * 60_000,
  blockMs: 15 * 60_000,
};

export const LOGIN_ACCOUNT_RULE: ThrottleRule = {
  limit: 5,
  windowMs: 15 * 60_000,
  blockMs: 15 * 60_000,
};

export interface ThrottleResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Records an attempt against `key` and reports whether it is allowed.
 * Fails OPEN on database errors so an infrastructure fault cannot lock every
 * user out of the platform; the failure is logged for operators.
 */
export async function consumeAttempt(key: string, rule: ThrottleRule): Promise<ThrottleResult> {
  const now = new Date();

  try {
    const existing = await prisma.authThrottle.findUnique({ where: { key } });

    if (existing?.blockedUntil && existing.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((existing.blockedUntil.getTime() - now.getTime()) / 1000),
      };
    }

    const windowExpired =
      !existing || now.getTime() - existing.windowStart.getTime() > rule.windowMs;

    if (windowExpired) {
      await prisma.authThrottle.upsert({
        where: { key },
        update: { count: 1, windowStart: now, blockedUntil: null },
        create: { key, count: 1, windowStart: now },
      });
      return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
    }

    const nextCount = existing.count + 1;

    if (nextCount > rule.limit) {
      const blockedUntil = new Date(now.getTime() + rule.blockMs);
      await prisma.authThrottle.update({
        where: { key },
        data: { count: nextCount, blockedUntil },
      });
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(rule.blockMs / 1000),
      };
    }

    await prisma.authThrottle.update({ where: { key }, data: { count: nextCount } });
    return { allowed: true, remaining: rule.limit - nextCount, retryAfterSeconds: 0 };
  } catch (error) {
    console.error('[throttle] backend unavailable, failing open', error);
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
}

/** Clears a bucket after a successful authentication. */
export async function resetAttempts(key: string): Promise<void> {
  try {
    await prisma.authThrottle.deleteMany({ where: { key } });
  } catch (error) {
    console.error('[throttle] failed to reset bucket', error);
  }
}
