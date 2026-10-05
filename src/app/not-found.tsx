import { getTranslations } from 'next-intl/server';
import { ButtonLink } from '@/components/ui/button-link';

export default async function NotFound() {
  const [t, tNav] = await Promise.all([getTranslations('errors'), getTranslations('nav')]);

  return (
    <main id="main" className="mx-auto flex max-w-lg flex-1 flex-col justify-center px-4 py-20 text-center">
      <p className="text-muted-foreground font-mono text-sm">404</p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{t('notFoundTitle')}</h1>
      <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{t('notFoundBody')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/">{tNav('dashboard')}</ButtonLink>
        <ButtonLink href="/countries" variant="outline">
          {tNav('countries')}
        </ButtonLink>
      </div>
    </main>
  );
}
