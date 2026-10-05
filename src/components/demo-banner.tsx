import { getTranslations } from 'next-intl/server';
import { FlaskConical } from 'lucide-react';

/**
 * Demo-mode strip.
 *
 * Rendered on every page when NEXT_PUBLIC_DEMO_MODE=true. Fabricated Member
 * State performance figures must never be able to pass as real STISA returns,
 * so this is deliberately unmissable rather than a subtle footnote.
 */
export async function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;

  const t = await getTranslations('demo');

  return (
    <div className="bg-warning text-warning-foreground relative z-100 px-4 py-1.5 text-center text-xs font-medium">
      <span className="inline-flex items-center gap-1.5">
        <FlaskConical className="size-3.5" aria-hidden />
        {t('banner')}
      </span>
    </div>
  );
}
