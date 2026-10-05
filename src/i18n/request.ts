import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, isLocale, type Locale } from './config';

/**
 * Resolves the request's language.
 *
 * The locale lives in a cookie rather than in the URL. That keeps all 29
 * existing routes intact — moving them under a `[locale]` segment would have
 * been a large, risky refactor for a platform already in use. The trade-off is
 * that a French page has no distinct URL, so it cannot be shared or indexed
 * separately; if that becomes important, next-intl's routing mode can be
 * layered on without changing any of the message files.
 *
 * Order of preference: explicit choice (cookie) -> browser Accept-Language ->
 * English.
 */
export async function resolveLocale(): Promise<Locale> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;

  try {
    const accept = (await headers()).get('accept-language') ?? '';
    // "fr-CH, fr;q=0.9, en;q=0.8" -> ["fr","fr","en"]
    const preferred = accept
      .split(',')
      .map((part) => part.split(';')[0]?.trim().split('-')[0]?.toLowerCase())
      .filter(Boolean) as string[];
    const match = preferred.find((code) => (LOCALES as readonly string[]).includes(code));
    if (isLocale(match)) return match;
  } catch {
    // Called outside a request scope.
  }

  return DEFAULT_LOCALE;
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    // Member State figures are institutional records: format them consistently
    // per locale rather than per server timezone.
    timeZone: 'UTC',
    now: new Date(),
  };
});
