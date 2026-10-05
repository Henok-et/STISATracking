'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';

import { setLocale } from '@/lib/actions/locale';
import { LOCALES, LOCALE_META, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

/**
 * Language chooser.
 *
 * Each option is written in its own language — a reader looking for Arabic
 * should not have to find the word "Arabic" in English first.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const current = useLocale() as Locale;
  const t = useTranslations('language');
  const [pending, startTransition] = useTransition();

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      <Languages
        className="text-muted-foreground pointer-events-none absolute start-2 size-4"
        aria-hidden
      />
      <select
        value={current}
        aria-label={t('change')}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocale(next);
          });
        }}
        className={cn(
          'border-input bg-background h-8 rounded-lg border ps-8 pe-2 text-sm',
          'focus-visible:ring-ring/50 focus-visible:ring-3 focus-visible:outline-none',
          pending && 'opacity-60',
        )}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
