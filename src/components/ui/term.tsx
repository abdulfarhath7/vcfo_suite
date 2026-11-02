'use client';

import type { ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { glossaryFor, leadingTerm, type GlossaryTerm } from '@/data/glossary';

/** The TP2 white info card: the code, one or two sentences, and the regulator under them. */
function TermCard({ entry, children, className }: { entry: GlossaryTerm; children: ReactNode; className?: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {/* Focusable, so keyboard users get the card too. The text stays plain text for screen readers. */}
          <span
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- it opens the info card on focus and does nothing on activation
            tabIndex={0}
            className={cn(
              'cursor-help rounded-sm underline decoration-line-strong decoration-dotted decoration-[1.5px] underline-offset-[3px] outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25',
              className,
            )}
          >
            {children}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            align="start"
            sideOffset={6}
            collisionPadding={12}
            className="z-[60] flex w-[260px] max-w-[calc(100vw-24px)] flex-col gap-[5px] rounded-md border-1.5 border-line bg-surface-raised px-3.5 py-3 text-ink shadow-float"
          >
            <span className="text-[13.5px] font-medium">{entry.term}</span>
            <span className="text-[13px] leading-5 text-ink-2">{entry.text}</span>
            <span className="text-[12px] text-ink-muted">{entry.by}</span>
            <TooltipPrimitive.Arrow width={12} height={6} className="fill-surface-raised" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

/**
 * TP2 (VCFO Spectrum B-12): a form code with a white info card on hover or focus, fed by
 * `src/data/glossary.ts`. Write `<Term>GSTR-3B</Term>`, or `<Term code="ADT-1">ADT-1 auditor
 * appointment</Term>`. A title that starts with a code ("GSTR-3B · September") marks only the
 * code. Text without a glossary entry renders as plain text.
 */
export function Term({ children, code, className }: { children: ReactNode; code?: string; className?: string }) {
  if (code) {
    const entry = glossaryFor(code);
    return entry ? (
      <TermCard entry={entry} className={className}>
        {children}
      </TermCard>
    ) : (
      <>{children}</>
    );
  }
  if (typeof children !== 'string') return <>{children}</>;
  const hit = leadingTerm(children);
  if (!hit) return <>{children}</>;
  return (
    <>
      <TermCard entry={hit.entry} className={className}>
        {children.slice(0, hit.end)}
      </TermCard>
      {children.slice(hit.end)}
    </>
  );
}
