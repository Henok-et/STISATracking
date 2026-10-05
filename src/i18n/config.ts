/**
 * Languages the platform speaks.
 *
 * The African Union works in Arabic, English, French, Portuguese, Spanish and
 * Kiswahili. These four cover the large majority of Member States; Spanish and
 * Kiswahili can be added by dropping in a messages file and one entry here —
 * nothing else in the application needs to change.
 *
 * IMPORTANT: indicator text is NEVER translated. `Indicator.sourceText` is the
 * verbatim transcription of the printed MEAL Plan, and a translated indicator
 * would no longer be the official framework. Interface chrome is localised;
 * institutional source text is not. See src/i18n/README.md.
 */

export const LOCALES = ['en', 'fr', 'ar', 'pt'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Cookie the chosen language is stored in. */
export const LOCALE_COOKIE = 'stisa-locale';

export interface LocaleMeta {
  code: Locale;
  /** Name of the language, written in that language. */
  nativeName: string;
  englishName: string;
  dir: 'ltr' | 'rtl';
  /** BCP 47 tag used for number and date formatting. */
  formatting: string;
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { code: 'en', nativeName: 'English', englishName: 'English', dir: 'ltr', formatting: 'en-GB' },
  fr: { code: 'fr', nativeName: 'Français', englishName: 'French', dir: 'ltr', formatting: 'fr-FR' },
  ar: { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl', formatting: 'ar' },
  pt: {
    code: 'pt',
    nativeName: 'Português',
    englishName: 'Portuguese',
    dir: 'ltr',
    formatting: 'pt-PT',
  },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function localeDir(locale: string): 'ltr' | 'rtl' {
  return isLocale(locale) ? LOCALE_META[locale].dir : 'ltr';
}
