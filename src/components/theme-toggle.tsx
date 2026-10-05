'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ORDER = ['system', 'light', 'dark'] as const;
type ThemeChoice = (typeof ORDER)[number];

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

/**
 * Subscribing to nothing, with a server snapshot of `false` and a client
 * snapshot of `true`, is the lint-clean way to ask "have we hydrated yet?".
 *
 * It matters here because next-themes reads localStorage *synchronously*, so
 * on the client the very first render already knows the stored theme while the
 * server could not. Rendering that value immediately produces a hydration
 * mismatch (server says "system", client says "light"). React uses the server
 * snapshot for the hydrating render and only then swaps, so both passes agree.
 *
 * The older `useState(false)` + `useEffect(() => setMounted(true))` pattern does
 * the same job but trips react-hooks/set-state-in-effect.
 */
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations('theme');
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  // Before hydration both passes render the neutral "system" state.
  const current: ThemeChoice = hydrated ? ((theme as ThemeChoice) ?? 'system') : 'system';
  const Icon = ICONS[current] ?? Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t(current)}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!)}
    >
      <Icon className="size-4" />
    </Button>
  );
}
