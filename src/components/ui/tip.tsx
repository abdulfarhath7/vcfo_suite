'use client';

import type { ReactElement } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Kbd } from '@/components/ui/kbd';

/**
 * TP3 (VCFO Spectrum B-12): a dark tip with the action name and its shortcut keys, navy in both
 * themes. Use it on icon-only buttons. The child is the trigger and keeps its own aria-label; the
 * tip only repeats the name for sighted users, and the keys go in `aria-keyshortcuts` on the child.
 */
export function Tip({
  label,
  keys,
  side = 'bottom',
  children,
}: {
  label: string;
  /** Key caps after the label, for example `['Ctrl', 'K']` or `['/']`. */
  keys?: string[];
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={300} skipDelayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={12}
            className="z-[60] inline-flex items-center gap-2 rounded-md border border-side-line bg-side py-1.5 pl-2.5 pr-2 text-[12.5px] text-white shadow-float"
          >
            <span>{label}</span>
            {keys?.map((k) => (
              <Kbd key={k} dark>
                {k}
              </Kbd>
            ))}
            <TooltipPrimitive.Arrow width={10} height={5} className="fill-side" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
