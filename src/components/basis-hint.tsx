'use client';

import { Info } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * The full "how this figure was calculated" sentence, folded behind an icon.
 *
 * Every aggregate still carries its basis, and it is still rendered — but on
 * dense lists a paragraph under each row buried the numbers. The short form
 * sits inline; the full sentence is here, one hover or focus away, and is
 * also in the accessible name of the trigger so it is never lost.
 */
export function BasisHint({ text, className }: { text: string; className?: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={text}
          className={
            className ??
            'text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-5 shrink-0 items-center justify-center rounded-sm align-middle focus-visible:ring-2 focus-visible:outline-none'
          }
        >
          <Info className="size-3.5" aria-hidden />
        </TooltipTrigger>
        <TooltipContent className="max-w-sm text-start leading-relaxed">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
