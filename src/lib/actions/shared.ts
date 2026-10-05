import 'server-only';

import { AuthorizationError } from '@/lib/auth/guards';

/**
 * Uniform Server Action result envelope.
 *
 * Actions never throw across the RPC boundary: an unhandled exception would
 * surface a stack trace or a generic digest to the user. Instead they return a
 * discriminated result the client can render safely, while unexpected errors
 * are logged server-side with full detail.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[]> };

export function ok(): ActionResult<void>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | void> {
  return { ok: true, data: data as T };
}

export function fail(
  error: string,
  code?: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> {
  return { ok: false, error, code, fieldErrors };
}

/**
 * Wraps an action body so authorization failures become clean messages and
 * anything unexpected becomes a generic message with no internal detail leaked.
 */
export async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return fail(error.message, error.code);
    }
    // Next's redirect() and notFound() signal via exceptions and must pass through.
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof (error as { digest?: unknown }).digest === 'string'
    ) {
      throw error;
    }
    console.error('[action] unhandled error', error);
    return fail('Something went wrong. The issue has been logged.', 'INTERNAL');
  }
}
