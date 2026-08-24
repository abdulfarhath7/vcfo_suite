"use client";

import { useMemo, useState } from 'react';
import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TONE_BADGE, toneForKey } from '@/components/common/IconChip';
import type { Engagement } from '@/data/engagements';
import { initialsFromName } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { companyPickerHint } from '@/components/admin/company-picker-utils';

const SEARCH_AFTER = 5;

export function CompanyPicker({
  engagements,
  value,
  onChange,
  allLabel = 'All companies',
  allHint = 'Full calendar',
}: {
  engagements: Engagement[];
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  allHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const showSearch = engagements.length >= SEARCH_AFTER;
  const selected = value === 'all' ? null : engagements.find((e) => e.id === value) ?? null;

  const triggerLabel = selected?.companyName ?? allLabel;
  const triggerHint = selected ? companyPickerHint(selected) : allHint;

  const items = useMemo(
    () =>
      engagements.map((e) => ({
        e,
        hint: companyPickerHint(e),
        initials: initialsFromName(e.companyName) || '•',
      })),
    [engagements],
  );

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Filter by company"
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'inline-flex h-9 min-w-[13.5rem] max-w-[22rem] items-center gap-2 rounded-lg border border-border bg-panel px-2.5 text-left shadow-sm transition-colors',
            'hover:border-role/35 hover:bg-role-soft/35',
            open && 'border-role/40 bg-role-soft/40 ring-2 ring-role/15',
          )}
        >
          {selected ? (
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-md text-[9.5px] font-bold',
                TONE_BADGE[toneForKey(selected.id)],
              )}
            >
              {initialsFromName(selected.companyName).slice(0, 2)}
            </span>
          ) : (
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary-light text-primary">
              <Building2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold leading-tight text-ink">
              {triggerLabel}
            </span>
            <span className="mt-px block truncate text-[10px] leading-tight text-muted-foreground">
              {triggerHint}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <Command className="rounded-md bg-transparent" loop>
          {showSearch ? (
            <CommandInput placeholder="Search companies…" className="h-9 text-[13px]" />
          ) : null}
          <CommandList className="max-h-72">
            <CommandEmpty className="py-4 text-center text-[13px] text-muted-foreground">
              No matching companies.
            </CommandEmpty>
            <CommandGroup className="p-1">
              <CommandItem
                value={`${allLabel} ${allHint} all`}
                onSelect={() => pick('all')}
                className="items-center gap-2 rounded-md px-2 py-1.5"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary-light text-primary">
                  <Building2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{allLabel}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{allHint}</span>
                </span>
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 text-primary',
                    value === 'all' ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
              </CommandItem>
              {items.map(({ e, hint, initials }) => {
                const on = value === e.id;
                return (
                  <CommandItem
                    key={e.id}
                    value={`${e.companyName} ${hint} ${e.id}`}
                    onSelect={() => pick(e.id)}
                    className="items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <span
                      className={cn(
                        'grid h-7 w-7 shrink-0 place-items-center rounded-md text-[10px] font-bold',
                        TONE_BADGE[toneForKey(e.id)],
                      )}
                    >
                      {initials.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{e.companyName}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{hint}</span>
                    </span>
                    <Check
                      className={cn('h-3.5 w-3.5 shrink-0 text-primary', on ? 'opacity-100' : 'opacity-0')}
                      aria-hidden
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
