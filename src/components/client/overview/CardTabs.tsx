'use client';

import type { ComponentType, CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export interface CardTab<T extends string> {
  id: T;
  label: string;
  count: number;
  /** Identifying hue as an oklch triplet var, e.g. `var(--primary)`. */
  hue?: string;
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
}

/** Segmented tabs with counts, shared by the dashboard cards. */
export function CardTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: CardTab<T>[];
  value: NoInfer<T>;
  onChange: (id: NoInfer<T>) => void;
  ariaLabel: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex min-w-0 flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const selected = tab.id === value;
        const hue = tab.hue;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            style={hue ? ({ '--tab': hue } as CSSProperties) : undefined}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              selected
                ? hue
                  ? 'border-[oklch(var(--tab)/0.4)] bg-[oklch(var(--tab)/0.12)] text-[oklch(var(--tab))] shadow-[0_4px_12px_-6px_oklch(var(--tab)/0.6)]'
                  : 'border-foreground bg-foreground text-background'
                : 'border-border bg-panel text-muted-foreground hover:border-foreground/25 hover:text-foreground',
              !selected && tab.count === 0 && 'opacity-70',
            )}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" strokeWidth={2} /> : null}
            {tab.label}
            <span
              className={cn(
                'mono min-w-[1.25rem] rounded-full px-1.5 text-center text-[10.5px] tabular-nums',
                selected
                  ? hue
                    ? 'bg-[oklch(var(--tab))] text-white'
                    : 'bg-background text-foreground'
                  : tab.count > 0
                    ? 'bg-foreground/10 text-foreground'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The first tab that has something in it, else the first tab. */
export function firstFilledTab<T extends string>(tabs: CardTab<T>[]): T {
  return (tabs.find((tab) => tab.count > 0) ?? tabs[0]!).id;
}
