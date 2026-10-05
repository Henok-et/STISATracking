'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { LOCALE_COOKIE, isLocale } from '@/i18n/config';

/**
 * Stores the reader's language choice.
 *
 * A cookie rather than a URL segment — see src/i18n/request.ts for why. It is
 * not httpOnly because nothing sensitive is in it, and a year is a reasonable
 * memory for a preference an institutional user sets once.
 */
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  // Every page renders translated text, so the whole tree is now stale.
  revalidatePath('/', 'layout');
}
