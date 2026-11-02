import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * The attention list (VCFO Spectrum R-20, prototype cards/AttentionList): full-width rows with a
 * 44px date tile tinted by urgency, a 13.5px title, a muted sub line, the status chip on the
 * right and an optional small navy action. An urgent row is soft red. With `today`, the sub line
 * starts with relative words ("In 3 days", "2 days late") in amber or red (E-11).
 */

export type Urgency = 'bad' | 'warn' | 'prog' | 'idle';

export interface AttentionRow {
  id: string;
  date: Date;
  title: string;
  sub?: string;
  chip: { label: string; tone?: ChipTone };
  /** Tint the row soft red (R-20). */
  urgent?: boolean;
  /** A small navy action on the right: "Open". */
  action?: { label: string; href: string };
  href?: string;
  /** Force the date tile tint. By default it comes from the date. */
  tint?: Urgency;
  /** A red alert tile in place of the date tile, with a red left edge. */
  alert?: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole days from `from` to `date` (negative when `date` has passed). */
export function daysFrom(date: Date, from: Date = new Date()): number {
  return Math.round((startOfDay(date) - startOfDay(from)) / DAY);
}

/** Tint for a date: overdue red, within 7 days amber, within 15 blurple, later grey. */
export function urgencyOf(date: Date, from: Date = new Date()): Urgency {
  const n = daysFrom(date, from);
  if (n < 0) return 'bad';
  if (n <= 7) return 'warn';
  if (n <= 15) return 'prog';
  return 'idle';
}

/** "Mon 19 Oct 2026": the exact date for tooltips (E-11). */
export function fullDate(d: Date): string {
  return `${WD[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** E-11: relative due words for attention lists. Tables keep plain dates (R-29). */
export function dueWords(date: Date, today: Date = new Date()): string {
  const n = daysFrom(date, today);
  if (n < -1) return `${-n} days late`;
  if (n === -1) return '1 day late';
  if (n === 0) return 'Due today';
  if (n === 1) return 'Due tomorrow';
  return `In ${n} days`;
}

const TILE_TONE: Record<Urgency, string> = {
  bad: 'border-transparent bg-danger-soft text-danger',
  warn: 'border-transparent bg-warning-soft text-warning',
  prog: 'border-brand-line bg-brand-soft text-brand-text',
  idle: 'border-line bg-surface-raised text-ink',
};

/** 44px date tile tinted by urgency: the day over the month in caps. The full date is the tooltip. */
export function DateTile({ date, tint, today, className }: { date: Date; tint?: Urgency; today?: Date; className?: string }) {
  const u = tint ?? urgencyOf(date, today);
  return (
    <span
      title={fullDate(date)}
      className={cn('grid w-11 flex-none place-items-center rounded-md border-1.5 py-1 leading-none', TILE_TONE[u], className)}
    >
      <b className="text-[16px] font-medium">{String(date.getDate()).padStart(2, '0')}</b>
      <span className={cn('text-[10.5px] font-medium uppercase tracking-wider', u === 'idle' ? 'text-ink-muted' : 'opacity-80')}>
        {MONTHS[date.getMonth()]}
      </span>
    </span>
  );
}

export function AttentionList({
  rows,
  today,
  empty = 'None',
  className,
}: {
  rows: AttentionRow[];
  /** Due lists only: start the sub line with relative words. */
  today?: Date;
  /** Words in the dashed empty area. */
  empty?: string;
  className?: string;
}) {
  if (rows.length === 0) return <EmptyState title={empty} className="m-4 md:mx-5" />;
  return (
    <ul className={className}>
      {rows.map((r) => {
        const n = today ? daysFrom(r.date, today) : 0;
        const body = (
          <>
            {r.alert ? (
              <span className="grid h-11 w-11 flex-none place-items-center rounded-md border border-danger bg-surface-raised text-danger" aria-hidden>
                <AlertCircle size={16} strokeWidth={1.6} />
              </span>
            ) : (
              <DateTile date={r.date} tint={r.tint} today={today} />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-semibold text-ink">{r.title}</span>
              {r.alert ? (
                <Chip tone={r.chip.tone} className="mt-1">
                  {r.chip.label}
                </Chip>
              ) : r.sub || today ? (
                <span className="block truncate text-[12.5px] text-ink-muted">
                  {today ? (
                    <span title={fullDate(r.date)} className={cn(n < 0 ? 'text-danger' : n <= 3 ? 'text-warning' : undefined)}>
                      {dueWords(r.date, today)}
                    </span>
                  ) : null}
                  {today && r.sub ? ' · ' : null}
                  {r.sub}
                </span>
              ) : null}
            </span>
            <span className="flex flex-none items-center gap-2">
              {!r.alert ? (
                <Chip tone={r.chip.tone} fixed>
                  {r.chip.label}
                </Chip>
              ) : null}
              {r.action ? (
                <Button asChild variant="strong" size="sm">
                  <Link href={r.action.href}>{r.action.label}</Link>
                </Button>
              ) : null}
            </span>
          </>
        );
        const cls = cn(
          'flex items-center gap-3 border-t border-line-soft px-4 py-3 md:px-5',
          r.urgent && 'bg-danger-soft',
          r.alert && 'border-l-2 border-l-danger',
          r.href && 'transition-colors hover:bg-hover',
        );
        return (
          <li key={r.id} className="[&:first-child>*]:border-t-0">
            {r.href ? (
              <Link href={r.href} className={cls}>
                {body}
              </Link>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
