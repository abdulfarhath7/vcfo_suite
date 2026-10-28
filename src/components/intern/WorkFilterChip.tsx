'use client';

import { Check, Plus, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface WorkFilterOption {
  value: string;
  label: string;
}

/**
 * Table head filter chip (VCFO Spectrum R-10, Q3; prototype `FilterChip`). An unset filter is a
 * dashed "+ Label" chip that opens a menu of options. A set filter has a soft blurple fill, the
 * picked value and an × that clears it. A chip with no options can only be cleared, for filters
 * that arrive from a link (a day or a focus from Today).
 */
export function WorkFilterChip({
  label,
  value,
  options,
  onChange,
  valueLabel,
}: {
  label: string;
  /** The picked option value, or an empty string when unset. */
  value: string;
  options: WorkFilterOption[];
  onChange: (value: string) => void;
  /** Shown instead of the option label, for set-only chips. */
  valueLabel?: string;
}) {
  const picked = options.find((o) => o.value === value);
  const shown = valueLabel ?? picked?.label;
  const menu =
    options.length > 0 ? (
      <DropdownMenuContent align="start" sideOffset={4} className="max-h-[320px] min-w-[180px] overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => onChange(o.value)} className="flex h-[34px] items-center gap-2">
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.value === value ? <Check className="h-3.5 w-3.5 text-brand-text" strokeWidth={1.6} aria-hidden /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    ) : null;

  if (value && shown) {
    const body = (
      <>
        <span className="text-ink-2">{label}</span>
        <b className="truncate font-medium">{shown}</b>
      </>
    );
    return (
      <span className="inline-flex h-7 max-w-full flex-none items-center gap-1.5 rounded-md border-1.5 border-brand-line bg-brand-soft pl-2.5 pr-1 text-[13px] text-brand-text">
        {menu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex min-w-0 items-center gap-1.5">
                {body}
              </button>
            </DropdownMenuTrigger>
            {menu}
          </DropdownMenu>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-1.5">{body}</span>
        )}
        <button
          type="button"
          aria-label={`Remove ${label} filter`}
          onClick={() => onChange('')}
          className="grid h-[18px] w-[18px] flex-none place-items-center rounded-sm text-brand-text hover:bg-surface-raised"
        >
          <X className="h-[13px] w-[13px]" strokeWidth={1.6} aria-hidden />
        </button>
      </span>
    );
  }

  if (!menu) return null;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 flex-none items-center gap-1.5 rounded-md border-1.5 border-dashed border-line-strong px-2.5 text-[13px] font-medium text-ink-2',
            'hover:bg-surface-sunken data-[state=open]:bg-surface-sunken',
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
          {label}
        </button>
      </DropdownMenuTrigger>
      {menu}
    </DropdownMenu>
  );
}
