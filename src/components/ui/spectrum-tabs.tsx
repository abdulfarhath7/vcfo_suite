'use client';

import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { tabStateClass } from '@/components/ui/tab-classes';

/** Event a tab switch sends up the tree. A card (`DashSection`) shows its L1 shapes for 300 ms. */
export const TAB_SWITCH_EVENT = 'vcfo:tab-switch';

function announce(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.dispatchEvent(new CustomEvent(TAB_SWITCH_EVENT, { bubbles: true }));
}

/* VCFO Spectrum tabs (rule R-11; prototype src/components/ui/Tabs.tsx). A segmented switch
   (N5, the default) is for filters: a quiet track. Underline tabs (N4) are for views of one
   record and sit on a rule. Both mark the open tab the same way (GL-03, `tab-classes.ts`). */

export interface SpectrumTabItem {
  key: string;
  label: string;
  count?: number | string;
}

export function SpectrumTabs({
  items,
  value,
  onChange,
  className,
  size = 'sm',
  variant = 'segmented',
  label,
}: {
  items: SpectrumTabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  variant?: 'segmented' | 'underline';
  /** Accessible name of the tab list. */
  label?: string;
}) {
  if (variant === 'underline')
    return (
      <div
        role="tablist"
        aria-label={label}
        className={cn('flex max-w-full items-end gap-1.5 overflow-x-auto border-b-1.5 border-line [scrollbar-width:none]', className)}
      >
        {items.map((t) => {
          const on = t.key === value;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={(e) => {
                if (!on) announce(e);
                onChange(t.key);
              }}
              className={cn(
                // The button overlaps the bar's rule by 1.5px, so the 3px underline covers it.
                '-mb-[1.5px] inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-t-md px-2.5 text-[14px] transition-colors',
                tabStateClass(on),
              )}
            >
              {t.label}
              {t.count !== undefined ? (
                <span className={cn('rounded-sm px-1.5 text-[12px] font-medium', on ? 'bg-brand-soft text-brand-text' : 'bg-surface-sunken text-ink-2')}>
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    );
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full flex-none items-center gap-0.5 overflow-x-auto rounded-md border-1.5 border-line bg-surface-sunken p-[3px] [scrollbar-width:none]',
        className,
      )}
    >
      {items.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={(e) => {
              if (!on) announce(e);
              onChange(t.key);
            }}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap px-3 text-[13px] transition-colors',
              size === 'sm' ? 'h-[22px]' : 'h-7',
              on ? 'rounded-t-mark' : 'rounded-mark',
              tabStateClass(on),
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className={cn('text-[12px] font-medium', on ? 'text-brand-text' : 'text-ink-muted')}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
