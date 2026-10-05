import Link from 'next/link';
import type { ComponentProps } from 'react';
import type { VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * A link that looks like a button.
 *
 * Base UI's Button takes a `render` prop rather than Radix's `asChild`, and
 * threading that through every navigation control obscures the markup. A
 * dedicated anchor component keeps the semantics honest — navigation is an
 * `<a>`, not a `<button>` — while reusing the exact button styling.
 */
export function ButtonLink({
  className,
  variant,
  size,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonVariants>) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

/** Same styling for external links and non-Next navigations (e.g. downloads). */
export function AnchorButton({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'a'> & VariantProps<typeof buttonVariants>) {
  return (
    <a
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
