'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export interface SearchableSelectProps {
  id?: string;
  value: string;
  options: readonly SearchableSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

/**
 * A select with a typing bar: the trigger looks like the plain `Select`, the
 * popover opens with a search input that filters the options as you type
 * (owner, 2026-10-21: "typing bar when selecting countries"). Used for long
 * pick lists — countries, states, nationalities — where scrolling is slow.
 */
export function SearchableSelect({
  id,
  value,
  options,
  onValueChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Type to search…',
  emptyText = 'No match.',
  disabled,
  invalid,
  describedBy,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const listId = React.useId();
  const selected = options.find((opt) => opt.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          className={cn(
            'box-border flex h-10 w-full items-center justify-between overflow-hidden rounded-md border border-input bg-panel px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40',
            className,
          )}
        >
          <span className={cn('line-clamp-1 text-left', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
      >
        <Command
          // Plain substring match ("uni" → United …), not cmdk's fuzzy scoring,
          // so a country list never surfaces Tunisia for "uni".
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0
          }
        >
          {/* The popover moves focus into its content on open, so the typing bar is focused without autoFocus. */}
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList id={listId}>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      opt.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
