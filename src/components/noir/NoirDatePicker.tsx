'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return undefined;
  return new Date(`${trimmed}T00:00:00`);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(value: string): string | null {
  const parsed = parseIsoDate(value);
  if (!parsed) return null;
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const noirCalendarClassNames = {
  month_caption: 'flex h-9 w-full items-center justify-center px-9 relative',
  dropdowns: 'flex w-full items-center justify-center gap-2 text-sm',
  dropdown_root: cn(
    'relative inline-flex items-center rounded-md border border-border bg-panel shadow-sm transition-colors',
    'has-[:focus]:border-primary/40 has-[:focus]:ring-2 has-[:focus]:ring-ring/40',
  ),
  dropdown: 'absolute inset-0 cursor-pointer opacity-0',
  months_dropdown: 'capitalize font-serif',
  years_dropdown: 'font-mono text-xs tracking-wide',
  caption_label: cn(
    'font-serif text-sm font-normal text-foreground select-none',
    'flex h-8 items-center gap-1 rounded-md px-2 py-1',
    '[&>svg]:size-3.5 [&>svg]:text-primary-dark',
  ),
  nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
  button_previous: cn(
    buttonVariants({ variant: 'outline' }),
    'h-7 w-7 bg-panel p-0 z-10 border-border opacity-70 hover:opacity-100 hover:border-primary/40 hover:bg-accent',
  ),
  button_next: cn(
    buttonVariants({ variant: 'outline' }),
    'h-7 w-7 bg-panel p-0 z-10 border-border opacity-70 hover:opacity-100 hover:border-primary/40 hover:bg-accent',
  ),
  weekday: 'text-muted-foreground rounded-md w-9 font-mono text-[0.65rem] uppercase tracking-wider font-normal',
  day_button: cn(
    buttonVariants({ variant: 'ghost' }),
    'h-9 w-9 p-0 font-normal rounded-md transition-colors duration-150 motion-reduce:transition-none',
    'hover:bg-accent hover:text-accent-foreground',
    'aria-selected:bg-primary aria-selected:text-primary-foreground',
    'aria-selected:hover:bg-primary-dark aria-selected:focus:bg-primary-dark',
  ),
  selected:
    'bg-primary text-primary-foreground hover:bg-primary-dark hover:text-primary-foreground focus:bg-primary-dark focus:text-primary-foreground',
  today: 'bg-accent/80 text-accent-foreground ring-1 ring-primary/40 font-medium',
  outside: 'text-muted-foreground opacity-40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
  disabled: 'text-muted-foreground opacity-40',
};

export interface NoirDatePickerProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function NoirDatePicker({
  id,
  value,
  onChange,
  onBlur,
  placeholder = 'Pick a date',
  className,
  disabled,
}: NoirDatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const display = value.trim() ? formatDisplayDate(value) : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onBlur?.();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={cn(
            'milestone-form-input flex h-10 w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0',
            !display && 'text-muted-foreground',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-primary-dark" aria-hidden />
          <span className="flex-1 truncate">{display ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          'w-auto rounded-lg border-border bg-panel p-0 shadow-md',
          'motion-reduce:animate-none motion-reduce:fade-in-0 motion-reduce:zoom-in-95',
        )}
      >
        <Calendar
          mode="single"
          captionLayout="dropdown"
          navLayout="after"
          defaultMonth={selected}
          selected={selected}
          onSelect={(date) => {
            if (date) {
              onChange(toIsoDate(date));
              setOpen(false);
              onBlur?.();
            }
          }}
          className="rounded-lg border-0 p-3"
          classNames={noirCalendarClassNames}
          formatters={{
            formatMonthDropdown: (date) =>
              date.toLocaleString('en-IN', { month: 'short' }),
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
