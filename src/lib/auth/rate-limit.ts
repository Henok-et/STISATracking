/**
 * Basic in-memory rate limiter for mitigating simple DoS and brute force attacks
 * on serverless or long-running node environments without Redis.
 *
 * NOTE: If this app is scaled horizontally across multiple instances (e.g. Vercel),
 * this map will be unique per instance, meaning the actual rate limit is `limit * instances`.
 * For a true global rate limit, replace this with Upstash Redis or similar.
 */

interface RateLimitTracker {
  count: number;
  resetAt: number;
}

const rateLimiter = new Map<string, RateLimitTracker>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 50, windowMs: 60000 },
): { success: boolean; limit: number; remaining: number; reset: number } {
  const now = Date.now();
  const record = rateLimiter.get(identifier);

  // Clean up expired or create new
  if (!record || now > record.resetAt) {
    const newRecord = {
      count: 1,
      resetAt: now + options.windowMs,
    };
    rateLimiter.set(identifier, newRecord);
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      reset: newRecord.resetAt,
    };
  }

  // Increment existing
  record.count += 1;
  const remaining = Math.max(0, options.limit - record.count);

  if (record.count > options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      reset: record.resetAt,
    };
  }

  return {
    success: true,
    limit: options.limit,
    remaining,
    reset: record.resetAt,
  };
}
