'use client';

/**
 * VCFO Spectrum parts for the client portal Compliances and Registrations pages (prototype
 * src/screens/client/comp-parts.tsx, item-parts.tsx and src/components/cards/*).
 *
 * The portal reverts Tailwind everywhere outside a `.cp-tw` island (css-src/00-tokens.css), so
 * every part here either wraps itself in an island or is placed inside `<Island>`. The page
 * rules in css-src/compliances-board.css skip `.cp-tw` islands, so the shared Spectrum parts
 * (chips, tabs, the T1 grid) draw exactly as on the staff portals.
 */
import { useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Check, ChevronDown, ExternalLink, Plus, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AreaPill, Chip, regOf, type ChipTone, type Regulator } from '@/components/ui/spectrum-chip';
import { DashSection } from '@/components/dash/DashSection';
import {
  AREA_FULL,
  AREA_LABEL,
  MON,
  daysBetween,
  dow,
  portalFor,
  type AreaCode,
  type CompStatus,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { usePortal } from '../../PortalProvider';
import { useDismiss } from './bits';

/* ------------------------------------------------------------------ island */

/** A Tailwind island inside the client portal. `inline` draws a span for use inside text. */
export function Island({ className, inline, children }: { className?: string; inline?: boolean; children: ReactNode }) {
  if (inline) return <span className={cn('cp-tw inline-flex min-w-0 align-middle', className)}>{children}</span>;
  return <div className={cn('cp-tw min-w-0', className)}>{children}</div>;
}

/* ------------------------------------------------------------ status words */

/**
 * R-13: the four register buckets in the six status words. A filed row is Done; an upcoming
 * row that is not yet in its due-soon window is Not started.
 */
export const WORD: Record<CompStatus, string> = { ok: 'Done', due: 'Due soon', over: 'Overdue', up: 'Not started' };
export const TONE: Record<CompStatus, ChipTone> = { ok: 'ok', due: 'warn', over: 'bad', up: 'idle' };
/** Solid marks for bars, legend squares and dots (R-25: status colours only in charts). */
export const FILL: Record<CompStatus, string> = { ok: 'bg-positive-mid', due: 'bg-warning-mid', over: 'bg-danger-mid', up: 'bg-upcoming-mid' };
/** SVG stroke colours for the donut, from the same tokens. */
export const STROKE: Record<CompStatus, string> = {
  ok: 'oklch(var(--positive-mid))',
  due: 'oklch(var(--warning-mid))',
  over: 'oklch(var(--danger-mid))',
  up: 'oklch(var(--upcoming-mid))',
};
/** Soft tint for a date tile or a day number. */
export const TINT: Record<CompStatus, string> = {
  ok: 'bg-positive-soft text-positive',
  due: 'bg-warning-soft text-warning',
  over: 'bg-danger-soft text-danger',
  up: 'bg-upcoming-soft text-ink',
};
/** Legend and drill order: worst first, then the rest. */
export const STATUS_ORDER: CompStatus[] = ['over', 'due', 'up', 'ok'];

/** R-13 status chip, 104px. `compact` keeps only the square dot for narrow rails (the word stays for screen readers). */
export function StatusChip({ s, compact, className }: { s: CompStatus; compact?: boolean; className?: string }) {
  if (compact)
    return (
      <span title={WORD[s]} className={cn('inline-flex h-6 w-6 flex-none items-center justify-center rounded-md', TINT[s], className)}>
        <i className={cn('h-[7px] w-[7px] rounded-[2px]', FILL[s])} aria-hidden />
        <span className="sr-only">{WORD[s]}</span>
      </span>
    );
  return (
    <Chip tone={TONE[s]} fixed className={className}>
      {WORD[s]}
    </Chip>
  );
}

const REG_OF_AREA: Record<AreaCode, Regulator> = { MCA: 'mca', GST: 'gst', IT: 'it', PAY: 'payroll', FEMA: 'fema' };
const REG_DOT: Record<Regulator, string> = {
  mca: 'bg-reg-mca',
  gst: 'bg-reg-gst',
  it: 'bg-reg-it',
  payroll: 'bg-reg-payroll',
  fema: 'bg-reg-fema',
  labour: 'bg-reg-labour',
};

/** R-43 area pill (104px). `compact` is the short tag for tight rails: the swatch and the code. */
export function AreaTag({ a, compact, className }: { a: AreaCode; compact?: boolean; className?: string }) {
  if (compact)
    return (
      <span
        title={AREA_FULL[a]}
        className={cn('inline-flex h-5 flex-none items-center gap-1 rounded-sm border-1.5 border-line bg-surface-raised px-1.5 text-[11px] font-medium text-ink-2', className)}
      >
        <i className={cn('h-1.5 w-1.5 flex-none rounded-[2px]', REG_DOT[REG_OF_AREA[a]])} aria-hidden />
        {a}
      </span>
    );
  return <AreaPill area={AREA_LABEL[a]} reg={REG_OF_AREA[a]} className={className} />;
}

/** Area pill for a free word (registrations: GST, Payroll, Labour, IP, FEMA). */
export function WordPill({ word, className }: { word: string; className?: string }) {
  return <AreaPill area={word} reg={regOf(word)} className={className} />;
}

/* -------------------------------------------------------------- date tile */

/** Date tile tinted by status: the day over the month (or the weekday when `weekday`). 44px, or 36px (`sm`) inside grid rows. */
export function DateTile({ iso, s, weekday, size = 'md', className }: { iso: string; s: CompStatus | 'none'; weekday?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const tint = s === 'none' ? 'border-1.5 border-line bg-surface-raised text-ink' : TINT[s];
  return (
    <span className={cn('grid flex-none place-content-center rounded-md text-center leading-none', size === 'sm' ? 'h-9 w-9' : 'h-11 w-11', tint, className)} aria-hidden>
      <b className={cn('font-medium', size === 'sm' ? 'text-[14px]' : 'text-[16px]')}>{Number(iso.slice(8, 10))}</b>
      <small className={cn('mt-0.5 font-medium uppercase tracking-wider opacity-80', size === 'sm' ? 'text-[10px]' : 'text-[10.5px]')}>{weekday ? dow(iso) : MON[Number(iso.slice(5, 7)) - 1]}</small>
    </span>
  );
}

/* ----------------------------------------------------------------- portal ↗ */

/** Rule 15: a small link to the government portal next to a filing name. */
export function PortalLink({ f, className }: { f: Pick<PortalFiling, 'area' | 'name'>; className?: string }) {
  const [label, url] = portalFor(f);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      title={`Open ${label}`}
      aria-label={`Open ${label}`}
      className={cn('inline-grid h-6 w-6 flex-none place-items-center rounded-sm text-ink-muted hover:bg-surface-sunken hover:text-brand-text', className)}
    >
      <ExternalLink size={13} strokeWidth={1.6} aria-hidden />
    </a>
  );
}

/* ------------------------------------------------------------- navigation */

/** A portal route as an anchor that navigates in place (keeps middle-click and copy link). */
export function GoLink({ href, className, label, children }: { href: string; className?: string; label?: string; children: ReactNode }) {
  const portal = usePortal();
  const onClick = (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    portal.go(href);
  };
  return (
    <a href={href} onClick={onClick} aria-label={label} className={className}>
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ cards */

/** Card (R-15, R-16) on the shared DashSection. `right` sits at the far right of the head; `flush` drops the body padding. */
export function SCard({
  title,
  meta,
  right,
  flush,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  const head =
    meta !== undefined || right ? (
      <span className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        {meta !== undefined ? <span className="rounded-sm bg-surface-sunken px-[7px] py-px text-[12px] font-medium text-ink-2">{meta}</span> : null}
        {right}
      </span>
    ) : undefined;
  return (
    <DashSection title={title} meta={head} className={className} bodyClassName={cn(flush ? 'p-0' : 'px-4 py-4 md:px-5', bodyClassName)}>
      {children}
    </DashSection>
  );
}

/** Empty body (R-48): a dashed area with the action. */
export function Empty({ children = 'None', action, className }: { children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('m-4 flex flex-col items-center gap-2.5 rounded-md border-1.5 border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-ink-muted md:mx-5', className)}>
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Full-width list row with a hairline between rows (R-19). */
export function ListRow({ children, className, onClick, label }: { children: ReactNode; className?: string; onClick?: () => void; label?: string }) {
  const base = cn('flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 text-[14px] text-ink first:border-t-0 md:px-5', onClick && 'hover:bg-surface-sunken', className);
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-label={label} className={cn(base, 'w-full text-left')}>
        {children}
      </button>
    );
  return <div className={base}>{children}</div>;
}

/* ------------------------------------------------------------- stacked bar */

export interface BarSegment {
  key: string;
  label: string;
  value: number;
  /** A solid token fill class (FILL above, or a step colour). */
  fill: string;
}

/** R-25 (C2): one stacked bar with its legend, in status colours. Legend rows drill down when `onPick` is set. */
export function StackedBar({ segments, onPick, height = 8, className }: { segments: BarSegment[]; onPick?: (key: string) => void; height?: 6 | 8 | 10; className?: string }) {
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div className={cn('grid gap-2.5', className)}>
      <span className="flex w-full gap-0.5 overflow-hidden rounded-bar bg-surface-sunken" style={{ height }} aria-hidden>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <i key={s.key} className={cn('block h-full rounded-[2px]', s.fill)} style={{ width: `${(s.value / sum) * 100}%` }} />
          ))}
      </span>
      <ul className="grid gap-1">
        {segments.map((s) => {
          const inner = (
            <>
              <i className={cn('h-2 w-2 flex-none rounded-[2px]', s.fill)} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
              <b className="pl-3 font-medium tabular-nums text-ink">{s.value}</b>
            </>
          );
          return (
            <li key={s.key}>
              {onPick ? (
                <button
                  type="button"
                  onClick={() => onPick(s.key)}
                  aria-label={`${s.label} · ${s.value} · show the list`}
                  className="flex w-full items-center gap-2 rounded-sm text-left text-[13px] text-ink-2 hover:text-brand-text"
                >
                  {inner}
                </button>
              ) : (
                <span className="flex w-full items-center gap-2 text-[13px] text-ink-2">{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------ head filters */

/**
 * R-10 filter chip for a table head bar. Set: a soft blurple fill with the value and an ×.
 * Not set: a dashed "+ Area" chip that opens a small menu (inside the portal, so it follows
 * the portal's theme).
 */
export function FilterMenu<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  /** null when the filter is not set. */
  value: V | null;
  options: Array<{ value: V; label: string; count?: number }>;
  onChange: (v: V | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useDismiss(open, box, () => setOpen(false));
  const cur = options.find((o) => o.value === value);
  const chip = 'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium';
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(e.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };
  return (
    <span ref={box} className="relative inline-flex">
      {cur ? (
        <span className={cn(chip, 'border-1.5 border-brand-line bg-brand-soft pr-1 text-brand-text')}>
          <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} aria-label={`${label}: ${cur.label}. Change`}>
            {cur.label}
          </button>
          <button type="button" onClick={() => onChange(null)} className="grid h-5 w-5 place-items-center rounded-sm hover:bg-surface-raised" aria-label={`Clear ${label}`}>
            <X size={13} strokeWidth={1.8} aria-hidden />
          </button>
        </span>
      ) : (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn(chip, 'border-1.5 border-dashed border-line-strong text-ink-2 hover:bg-surface-sunken hover:text-ink')}
        >
          <Plus size={14} strokeWidth={1.8} aria-hidden /> {label}
        </button>
      )}
      {open ? (
        <div
          role="menu"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={onKey}
          className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[180px] overflow-hidden rounded-md border border-line bg-surface-raised p-1 text-[14px] text-ink shadow-float"
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="menuitemradio"
              aria-checked={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex h-[34px] w-full items-center gap-3 rounded-sm px-2.5 text-left hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.count !== undefined ? <span className="text-[12px] tabular-nums text-ink-muted">{o.count}</span> : null}
              {o.value === value ? <Check size={14} strokeWidth={1.8} className="text-brand-text" aria-hidden /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

/** Compact search box for a card head. Enter opens the first match; Esc clears. */
export function HeadSearch({ value, onChange, onEnter, label }: { value: string; onChange: (v: string) => void; onEnter?: () => void; label: string }) {
  return (
    <span className="relative inline-flex">
      <Search size={14} strokeWidth={1.6} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.();
          if (e.key === 'Escape') onChange('');
        }}
        placeholder="Search"
        aria-label={label}
        className="h-[30px] w-[150px] rounded-md border-1.5 border-line-strong bg-surface-raised pl-8 pr-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
      />
    </span>
  );
}

/** A group head that folds its rows (R-24): a plain chevron, the label in capitals and the count. */
export function GroupHead({ label, count, open, onToggle }: { label: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 border-t border-line-soft bg-surface-sunken px-4 py-1.5 text-left text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted first:border-t-0 hover:text-ink md:px-5"
    >
      <ChevronDown size={14} strokeWidth={1.8} className={cn('transition-transform', !open && '-rotate-90')} aria-hidden />
      {label}
      <span className="text-ink-faint">{count}</span>
    </button>
  );
}

/** Label and value rows of a record (R-28: identifiers in mono). */
export function FactRows({ rows }: { rows: Array<{ k: string; v: ReactNode; mono?: boolean; empty?: boolean }> }) {
  return (
    <dl>
      {rows.map((r) => (
        <div key={r.k} className="grid min-h-[44px] grid-cols-[150px_minmax(0,1fr)] items-center gap-4 border-t border-line-soft px-4 py-2 first:border-t-0 sm:grid-cols-[190px_minmax(0,1fr)] md:px-5">
          <dt className="text-[13px] text-ink-muted">{r.k}</dt>
          <dd className={cn('min-w-0 break-words text-[14px] font-medium text-ink', r.mono && 'font-mono text-[13.5px]', r.empty && 'font-normal text-ink-faint')}>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------ record head */

export interface HeadFact {
  k: string;
  v: ReactNode;
  tone?: 'bad';
}

/**
 * Plain record head (R-02): the title, a muted meta line, the status chips and the key facts
 * in one row, with the record's main actions on the right.
 */
export function RecordHead({ title, sub, chips, facts, actions }: { title: string; sub?: ReactNode; chips?: ReactNode; facts: HeadFact[]; actions?: ReactNode }) {
  return (
    <header className="flex min-w-0 flex-wrap items-start gap-x-6 gap-y-4" aria-label={title}>
      <div className="min-w-0 flex-[1_1_320px]">
        <h1 className="text-[24px] font-medium leading-tight tracking-[-0.01em] text-ink md:text-[28px]">{title}</h1>
        {sub ? <p className="mt-1 text-[14px] text-ink-muted">{sub}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          {chips}
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13.5px]">
            {facts.map((f) => (
              <div key={f.k} className="flex items-baseline gap-1.5">
                <dt className="text-ink-muted">{f.k}</dt>
                <dd className={cn('font-medium text-ink', f.tone === 'bad' && 'text-danger')}>{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {actions ? <div className="flex flex-none flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** "In 3 days", "Due today", "2 days late": the relative due word and its chip tone. */
export function relativeDue(today: string, due: string): { label: string; tone: ChipTone } {
  const d = daysBetween(today, due);
  if (d < 0) return { label: `${-d} ${d === -1 ? 'day' : 'days'} late`, tone: 'bad' };
  if (d === 0) return { label: 'Due today', tone: 'warn' };
  return { label: `In ${d} ${d === 1 ? 'day' : 'days'}`, tone: d <= 7 ? 'warn' : 'idle' };
}
