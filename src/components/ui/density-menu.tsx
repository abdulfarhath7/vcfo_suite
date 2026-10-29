'use client';

import { Check, Rows3, Rows4, type LucideIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Density } from '@/lib/ui/table-prefs';

export type { Density };

const OPTIONS: Array<[Density, string, string, LucideIcon]> = [
  ['comfortable', 'Comfortable', '44 px', Rows3],
  ['compact', 'Compact', '32 px', Rows4],
];

/**
 * E-07 density switch: a 28px icon button in the table head that opens a small D2 menu with
 * Comfortable (44px rows) and Compact (32px rows). Keep the choice with `useDensity`.
 */
export function DensityMenu({ value, onChange, className }: { value: Density; onChange: (d: Density) => void; className?: string }) {
  const Icon = value === 'compact' ? Rows4 : Rows3;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-grid-ctl
          aria-label={`Row density: ${value === 'compact' ? 'Compact' : 'Comfortable'}`}
          title="Row density"
          className={cn(
            'grid h-7 w-7 flex-none place-items-center rounded-md text-ink-muted hover:bg-ink/[.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-[state=open]:bg-ink/[.06] data-[state=open]:text-ink',
            className,
          )}
        >
          <Icon className="h-[15px] w-[15px]" strokeWidth={1.6} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={12} className="w-[210px] normal-case tracking-normal">
        <DropdownMenuLabel className="pb-1 text-[12px] font-medium text-ink-muted">Row density</DropdownMenuLabel>
        {OPTIONS.map(([k, label, px, OptionIcon]) => (
          <DropdownMenuItem key={k} onSelect={() => onChange(k)} className="flex h-[34px] items-center gap-2.5">
            <OptionIcon className="h-[15px] w-[15px] flex-none text-ink-muted" strokeWidth={1.6} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="text-[12px] text-ink-muted">{px}</span>
            <Check className={cn('h-3.5 w-3.5 flex-none text-brand-text', value !== k && 'invisible')} strokeWidth={1.6} aria-hidden />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
