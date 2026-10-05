'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';

/**
 * Top-level error boundary.
 *
 * Deliberately shows no stack trace or message from the thrown error — those
 * can carry query fragments or identifiers. The digest is enough for an
 * operator to correlate the report with the server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  const tNav = useTranslations('nav');

  useEffect(() => {
    console.error('[boundary]', error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold sm:text-3xl">{t('errorTitle')}</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{t('errorBody')}</p>
      {error.digest ? (
        <p className="text-muted-foreground mt-3 font-mono text-xs">
          {t('reference')} {error.digest}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>{t('tryAgain')}</Button>
        <ButtonLink href="/" variant="outline">
          {tNav('dashboard')}
        </ButtonLink>
      </div>
    </main>
  );
}
