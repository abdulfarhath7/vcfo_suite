'use client';

import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface AreaFilterOption {
  key: string;
  label: string;
  count: number;
  /** Background class of the act's colour dot, when it has one. */
  dot?: string;
}

/**
 * The Acts filter as one compact dropdown (design system "Filters"): tick one act or several, each
 * with its colour dot and count, and Clear goes back to all. The button names the pick: "All
 * acts · 27", "GST · 8", "GST, Income tax · 18", or "GST +2 · 21". An empty pick means all.
 */
export function AreaFilterMenu({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly AreaFilterOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const on = options.filter((o) => value.includes(o.key));
  const total = (on.length ? on : options).reduce((sum, o) => sum + o.count, 0);
  const name =
    on.length === 0 ? 'All acts' : on.length <= 2 ? on.map((o) => o.label).join(', ') : `${on[0]!.label} +${on.length - 1}`;
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Acts: ${name}, ${total}`}
          className={cn(
            'inline-flex h-8 max-w-[260px] flex-none items-center gap-1.5 rounded-md border-1.5 px-2.5 text-[13px] font-medium shadow-control outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25',
            on.length ? 'border-brand bg-brand-soft text-brand-text' : 'border-line-strong bg-surface-raised text-ink',
            className,
          )}
        >
          <span className="truncate">{name}</span>
          <span className={cn('tabular-nums', on.length ? 'text-brand-text/80' : 'text-ink-muted')}>· {total}</span>
          <ChevronDown size={14} strokeWidth={1.6} className="flex-none opacity-70" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[250px] p-1.5">
        <div className="flex items-center px-2.5 pb-1 pt-1.5 text-[12px] font-semibold text-ink-muted">
          Acts
          <button
            type="button"
            className="ml-auto font-medium text-brand-text hover:underline disabled:opacity-40 disabled:no-underline"
            disabled={on.length === 0}
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
        <ul role="group" aria-label="Acts">
          {options.map((o) => {
            const id = `area-filter-${o.key.replace(/[^a-z0-9]+/gi, '-')}`;
            return (
              <li key={o.key}>
                <label
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] text-ink hover:bg-surface-sunken"
                >
                  <Checkbox id={id} checked={value.includes(o.key)} onCheckedChange={() => toggle(o.key)} />
                  {o.dot ? <i className={cn('h-2 w-2 flex-none rounded-[2px]', o.dot)} aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  <span className="tabular-nums text-ink-muted">{o.count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
