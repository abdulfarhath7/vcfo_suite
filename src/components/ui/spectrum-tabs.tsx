'use client';

import type { MouseEvent } from 'react';
import { cn } from '@/lib/utils';

/** Event a tab switch sends up the tree. A card (`DashSection`) shows its L1 shapes for 300 ms. */
export const TAB_SWITCH_EVENT = 'vcfo:tab-switch';

function announce(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.dispatchEvent(new CustomEvent(TAB_SWITCH_EVENT, { bubbles: true }));
}

/* VCFO Spectrum tabs (rule R-11; prototype src/components/ui/Tabs.tsx). A segmented switch
   (N5, the default) is for filters: a quiet track, the picked option blurple with white text.
   Underline tabs (N4) are for views of one record: a 2px blurple underline. */

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
        className={cn('flex max-w-full items-end gap-5 overflow-x-auto border-b-1.5 border-line [scrollbar-width:none]', className)}
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
                '-mb-[1.5px] inline-flex h-10 items-center gap-1.5 whitespace-nowrap border-b-2 text-[14px] font-medium transition-colors',
                on ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink',
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
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-mark px-3 text-[13px] font-medium transition-colors',
              size === 'sm' ? 'h-[22px]' : 'h-7',
              on ? 'bg-brand text-on-brand shadow-shine' : 'text-ink-2 hover:text-ink',
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className={cn('text-[12px] font-medium', on ? 'text-on-brand/85' : 'text-ink-muted')}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
