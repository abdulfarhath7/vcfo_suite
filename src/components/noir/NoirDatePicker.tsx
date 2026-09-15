'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DMY_RE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const DAY_MONTH_YEAR_RE = /^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i;

const MONTH_NAMES = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleString('en-IN', { month: 'long' }),
);

/**
 * Every date this app records — birth dates, old incorporations, expiries a
 * few years out — fits this window. It also bounds the year grid.
 */
const CALENDAR_START = new Date(1940, 0, 1);
const CALENDAR_END = new Date(new Date().getFullYear() + 30, 11, 31);
const YEARS = Array.from(
  { length: CALENDAR_END.getFullYear() - CALENDAR_START.getFullYear() + 1 },
  (_, i) => CALENDAR_START.getFullYear() + i,
);

function makeDate(year: number, monthIndex: number, day: number): Date | undefined {
  const date = new Date(year, monthIndex, day);
  // `new Date(2026, 1, 31)` silently rolls into March — reject that.
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

function parseIsoDate(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return undefined;
  const [y, m, d] = trimmed.split('-').map(Number);
  return makeDate(y, m - 1, d);
}

/**
 * What a person might type: `15/09/2026`, `15-09-2026`, `15.09.2026`,
 * `2026-09-15`, `15 Sep 2026`, `15 September 2026`.
 */
function parseTypedDate(text: string): Date | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const iso = parseIsoDate(trimmed);
  if (iso) return iso;
  const dmy = DMY_RE.exec(trimmed);
  if (dmy) return makeDate(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  const named = DAY_MONTH_YEAR_RE.exec(trimmed);
  if (named) {
    const needle = named[2].toLowerCase();
    const monthIndex = MONTH_NAMES.findIndex((name) => {
      const lower = name.toLowerCase();
      return lower === needle || (needle.length >= 3 && lower.startsWith(needle));
    });
    if (monthIndex >= 0) return makeDate(Number(named[3]), monthIndex, Number(named[1]));
  }
  return undefined;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toTypedDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

function formatFromIso(value: string): string {
  const parsed = parseIsoDate(value);
  return parsed ? toTypedDate(parsed) : '';
}

/**
 * Slots digits into `DD/MM/YYYY` as they are typed, so `15092026` reads as
 * `15/09/2026` without the person hunting for the slash key. Anything that is
 * not plain digits (an ISO paste, a month name) is left as typed.
 */
function maskTyped(raw: string, previous: string): string {
  if (!/^[\d/.-]*$/.test(raw) || /^\d{4}-/.test(raw)) return raw;
  // A separator after a single digit means that slot is done: `1/9/` → `01/09/`.
  const parts = raw.split(/[/.-]/);
  const digits = parts
    .map((part, index) => {
      const slotDone = index < parts.length - 1 && index < 2;
      return slotDone && part.length === 1 ? `0${part}` : part;
    })
    .join('')
    .slice(0, 8);
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `/${digits.slice(2, 4)}`;
  if (digits.length > 4) out += `/${digits.slice(4, 8)}`;
  const typingForward = raw.length > previous.length;
  if (typingForward && (digits.length === 2 || digits.length === 4)) out += '/';
  return out;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function clampMonth(date: Date): Date {
  if (date < CALENDAR_START) return startOfMonth(CALENDAR_START);
  if (date > CALENDAR_END) return startOfMonth(CALENDAR_END);
  return startOfMonth(date);
}

const noirCalendarClassNames = {
  // The caption and nav are drawn by NoirDatePicker's own header.
  month_caption: 'hidden',
  weekday:
    'text-muted-foreground rounded-md w-9 font-mono text-[0.65rem] uppercase tracking-wider font-normal',
  day_button: cn(
    buttonVariants({ variant: 'ghost' }),
    'h-9 w-9 p-0 font-normal rounded-md transition-colors duration-150 motion-reduce:transition-none',
    'hover:bg-accent hover:text-accent-foreground',
    // react-day-picker marks the <td> selected, not the button, and the ghost
    // variant's `text-primary` would otherwise paint blue on blue.
    '[[aria-selected=true]_&]:text-primary-foreground',
    '[[aria-selected=true]_&]:hover:bg-primary-dark [[aria-selected=true]_&]:hover:text-primary-foreground',
  ),
  selected:
    'bg-primary text-primary-foreground hover:bg-primary-dark hover:text-primary-foreground focus:bg-primary-dark focus:text-primary-foreground',
  today: 'bg-accent/80 text-accent-foreground ring-1 ring-primary/40 font-medium',
  outside:
    'text-muted-foreground opacity-40 aria-selected:bg-accent/50 aria-selected:text-muted-foreground',
  disabled: 'text-muted-foreground opacity-40',
};

const navButtonClass = cn(
  buttonVariants({ variant: 'outline' }),
  'h-7 w-7 bg-panel p-0 border-border opacity-70 hover:opacity-100 hover:border-primary/40 hover:bg-accent',
  'disabled:opacity-30 disabled:hover:bg-panel',
);

const captionButtonClass = cn(
  'inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm font-medium text-foreground',
  'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
  '[&>svg]:size-3.5 [&>svg]:text-primary-dark',
);

const gridCellClass = cn(
  buttonVariants({ variant: 'ghost' }),
  'h-9 w-full rounded-md px-0 font-normal transition-colors duration-150 motion-reduce:transition-none',
  'hover:bg-accent hover:text-accent-foreground',
  'data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground data-[selected=true]:hover:bg-primary-dark',
  'data-[current=true]:ring-1 data-[current=true]:ring-primary/40',
);

const footerButtonClass =
  'rounded-md px-2 py-1 text-xs font-medium text-primary-dark hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40 disabled:hover:bg-transparent';

type CalendarView = 'days' | 'months' | 'years';

export interface NoirDatePickerProps {
  id?: string;
  /** ISO `YYYY-MM-DD` or empty. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Date field: type it (`15/09/2026`, slashes added for you) or pick it. The
 * calendar's month and year are each a tap away — a month grid and a
 * scrollable year grid — so a birth date in 1978 or an expiry in 2029 is three
 * clicks, not thirty arrow presses.
 */
export function NoirDatePicker({
  id,
  value,
  onChange,
  onBlur,
  className,
  disabled,
}: NoirDatePickerProps) {
  const selected = parseIsoDate(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CalendarView>('days');
  const [month, setMonth] = useState<Date>(() => clampMonth(selected ?? new Date()));
  const [text, setText] = useState(() => formatFromIso(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // The parent owns the value; when it changes underneath us (a reset, a
  // reload) the field follows, unless the text already says the same date.
  useEffect(() => {
    setText((current) => {
      const typed = parseTypedDate(current);
      if (typed && toIsoDate(typed) === value) return current;
      if (!current.trim() && !value) return current;
      return formatFromIso(value);
    });
  }, [value]);

  const commit = (date: Date | undefined) => {
    onChange(date ? toIsoDate(date) : '');
    if (date) setMonth(clampMonth(date));
  };

  const handleTextChange = (raw: string) => {
    const next = maskTyped(raw, text);
    setText(next);
    if (!next.trim()) {
      commit(undefined);
      return;
    }
    const parsed = parseTypedDate(next);
    if (parsed) commit(parsed);
  };

  /**
   * Leaving the field: a complete date is shown in canonical `DD/MM/YYYY`;
   * half a date falls back to the last good value so what is shown is always
   * what is stored.
   */
  const settleText = () => {
    if (!text.trim()) return;
    const parsed = parseTypedDate(text);
    setText(parsed ? toTypedDate(parsed) : formatFromIso(value));
  };

  const openCalendar = (next: boolean) => {
    if (next) {
      setView('days');
      setMonth(clampMonth(selected ?? new Date()));
    }
    setOpen(next);
    if (!next) onBlur?.();
  };

  const today = new Date();
  const canGoBack = month > startOfMonth(CALENDAR_START);
  const canGoForward = month < startOfMonth(CALENDAR_END);
  const stepMonth = (delta: number) =>
    setMonth(clampMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1)));
  const stepYear = (delta: number) =>
    setMonth(clampMonth(new Date(month.getFullYear() + delta, month.getMonth(), 1)));

  return (
    <Popover open={open} onOpenChange={openCalendar}>
      <div
        className={cn(
          'milestone-form-input relative flex h-10 w-full items-center rounded-md border',
          'focus-within:ring-2 focus-within:ring-ring/40',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={text}
          placeholder="DD/MM/YYYY"
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={() => {
            settleText();
            // With the calendar open, focus moves into it; closing it reports the blur.
            if (!open) onBlur?.();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              settleText();
              if (open) openCalendar(false);
            } else if (e.key === 'ArrowDown' && !open) {
              e.preventDefault();
              openCalendar(true);
            }
          }}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent pl-3 pr-1 text-sm text-foreground',
            'placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed',
          )}
        />
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Open calendar"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              'mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-primary-dark',
              'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
              'disabled:cursor-not-allowed',
            )}
          >
            <CalendarIcon className="h-4 w-4" aria-hidden />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="end"
        className={cn(
          'w-[284px] rounded-lg border-border bg-panel p-3 shadow-md',
          'motion-reduce:animate-none motion-reduce:fade-in-0 motion-reduce:zoom-in-95',
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <button
            type="button"
            aria-label={view === 'days' ? 'Previous month' : 'Previous year'}
            disabled={view === 'years' || (view === 'days' ? !canGoBack : month.getFullYear() <= CALENDAR_START.getFullYear())}
            onClick={() => (view === 'days' ? stepMonth(-1) : stepYear(-1))}
            className={cn(navButtonClass, view === 'years' && 'invisible')}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Choose month"
              aria-expanded={view === 'months'}
              onClick={() => setView(view === 'months' ? 'days' : 'months')}
              className={cn(captionButtonClass, 'font-serif', view === 'months' && 'bg-accent')}
            >
              {MONTH_NAMES[month.getMonth()]}
              <ChevronDown aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Choose year"
              aria-expanded={view === 'years'}
              onClick={() => setView(view === 'years' ? 'days' : 'years')}
              className={cn(captionButtonClass, 'font-mono tracking-wide', view === 'years' && 'bg-accent')}
            >
              {month.getFullYear()}
              <ChevronDown aria-hidden />
            </button>
          </div>
          <button
            type="button"
            aria-label={view === 'days' ? 'Next month' : 'Next year'}
            disabled={view === 'years' || (view === 'days' ? !canGoForward : month.getFullYear() >= CALENDAR_END.getFullYear())}
            onClick={() => (view === 'days' ? stepMonth(1) : stepYear(1))}
            className={cn(navButtonClass, view === 'years' && 'invisible')}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {view === 'days' ? (
          <Calendar
            mode="single"
            month={month}
            onMonthChange={(next) => setMonth(clampMonth(next))}
            startMonth={CALENDAR_START}
            endMonth={CALENDAR_END}
            hideNavigation
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              setText(toTypedDate(date));
              commit(date);
              openCalendar(false);
            }}
            className="p-0"
            classNames={noirCalendarClassNames}
          />
        ) : view === 'months' ? (
          <div role="listbox" aria-label="Month" className="grid grid-cols-3 gap-1">
            {MONTH_NAMES.map((name, index) => {
              const candidate = new Date(month.getFullYear(), index, 1);
              const outOfRange = candidate < startOfMonth(CALENDAR_START) || candidate > startOfMonth(CALENDAR_END);
              return (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={index === month.getMonth()}
                  data-selected={index === month.getMonth()}
                  data-current={
                    today.getFullYear() === month.getFullYear() && today.getMonth() === index
                  }
                  disabled={outOfRange}
                  onClick={() => {
                    setMonth(candidate);
                    setView('days');
                  }}
                  className={cn(gridCellClass, 'font-serif text-sm')}
                >
                  {name.slice(0, 3)}
                </button>
              );
            })}
          </div>
        ) : (
          <YearGrid
            year={month.getFullYear()}
            currentYear={today.getFullYear()}
            onPick={(year) => {
              setMonth(clampMonth(new Date(year, month.getMonth(), 1)));
              setView('days');
            }}
          />
        )}

        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <button
            type="button"
            disabled={!value}
            onClick={() => {
              setText('');
              commit(undefined);
              openCalendar(false);
              inputRef.current?.focus();
            }}
            className={footerButtonClass}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setText(toTypedDate(now));
              commit(now);
              openCalendar(false);
            }}
            className={footerButtonClass}
          >
            Today
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function YearGrid({
  year,
  currentYear,
  onPick,
}: {
  year: number;
  currentYear: number;
  onPick: (year: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Open with the current year in the middle rather than 1940 at the top.
  useEffect(() => {
    const container = scrollRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    container.scrollTop = active.offsetTop - container.clientHeight / 2 + active.clientHeight / 2;
  }, []);

  return (
    <div
      ref={scrollRef}
      role="listbox"
      aria-label="Year"
      className="grid max-h-[252px] grid-cols-4 gap-1 overflow-y-auto pr-1"
    >
      {YEARS.map((candidate) => (
        <button
          key={candidate}
          ref={candidate === year ? activeRef : undefined}
          type="button"
          role="option"
          aria-selected={candidate === year}
          data-selected={candidate === year}
          data-current={candidate === currentYear}
          onClick={() => onPick(candidate)}
          className={cn(gridCellClass, 'font-mono text-xs tracking-wide')}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}
