'use client';

import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { DashDonut, DashSection } from '@/components/dash/DashSection';
import { Chip } from '@/components/ui/spectrum-chip';
import { cn } from '@/lib/utils';
import type { FilingStatus } from '@/lib/compliance/filings';
import {
  CHART_STATUSES,
  FILING_WORD,
  SIX_TONE,
  STATUS_FILL,
  STATUS_STROKE,
  STATUS_TILE,
  tileParts,
  type SixWord,
} from '@/views/compliances/spectrum-status';

/**
 * Small Spectrum pieces shared by the staff compliance screens (Calendar,
 * Filings, Obligations, Registrations). They are compositions of the shared
 * parts (`Chip`, `DashSection`, `DashDonut`), not new primitives: a status
 * chip that speaks the six words, the 44px date tile, the status donut card,
 * the number strip that filters a table, and the rail list and flow cards.
 */

/** R-13 status chip with one of the six words. */
export function WordChip({ word, fixed = true, className }: { word: SixWord; fixed?: boolean; className?: string }) {
  return (
    <Chip tone={SIX_TONE[word]} fixed={fixed} className={className}>
      {word}
    </Chip>
  );
}

/** A compact status chip for rails and calendar days: the dot and the word, no fixed width. */
export function CompactChip({ word }: { word: SixWord }) {
  return (
    <Chip tone={SIX_TONE[word]} className="h-5 min-w-0 gap-1.5 px-1.5 text-[11.5px]">
      {word}
    </Chip>
  );
}

/** 44px date tile: the day over the short month, in the status colour. */
export function DateTile({
  iso,
  status,
  className,
}: {
  iso: string;
  status: FilingStatus;
  className?: string;
}) {
  const { day, month } = tileParts(iso);
  return (
    <span
      className={cn(
        'inline-flex h-11 w-11 flex-none flex-col items-center justify-center rounded-md leading-none',
        STATUS_TILE[status],
        className,
      )}
      aria-label={`Due ${day} ${month}`}
    >
      <b className="text-[16px] font-medium">{day}</b>
      <span className="mt-[3px] text-[10.5px] font-medium uppercase tracking-[.06em]">{month}</span>
    </span>
  );
}

/** The 8px square swatch before a legend word. */
export function Swatch({ className }: { className: string }) {
  return <i className={cn('h-2 w-2 flex-none rounded-[2px]', className)} aria-hidden />;
}

/** Status donut (R-25 C1): the four register statuses with a legend. */
export function StatusDonutCard({
  counts,
  caption,
  label,
}: {
  counts: Record<FilingStatus, number>;
  caption: string;
  label: string;
}) {
  const total = CHART_STATUSES.reduce((n, s) => n + counts[s], 0);
  return (
    <section className="surface flex items-center gap-4 px-4 py-3" aria-label={label}>
      <DashDonut
        size={88}
        centerLabel={total}
        centerCaption={caption}
        segments={
          total
            ? CHART_STATUSES.map((s) => ({ n: counts[s], color: STATUS_STROKE[s] }))
            : [{ n: 1, color: 'oklch(var(--line-soft))' }]
        }
      />
      <ul className="grid min-w-0 flex-1 grid-cols-1 gap-1.5">
        {CHART_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-2 text-[12.5px] font-medium text-ink-2">
            <Swatch className={STATUS_FILL[s]} />
            <span className="flex-1">{FILING_WORD[s]}</span>
            <b className="font-medium tabular-nums text-ink">{counts[s]}</b>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A stacked bar in status colours, sized by count. */
export function StatusBar({ counts, label }: { counts: Record<FilingStatus, number>; label: string }) {
  return (
    <span className="flex h-2 min-w-0 flex-1 gap-0.5 overflow-hidden rounded-bar bg-surface-sunken" title={label}>
      {CHART_STATUSES.map((s) =>
        counts[s] ? (
          <i key={s} className={cn('block h-full', STATUS_FILL[s])} style={{ flex: counts[s] }} title={`${FILING_WORD[s]} · ${counts[s]}`} />
        ) : null,
      )}
    </span>
  );
}

export interface StripItem {
  key: string;
  label: string;
  value: number;
  Icon: LucideIcon;
  /** Text colour of the number when it is above zero. */
  valueClass?: string;
}

/**
 * R-18 number tiles that filter the table below. A click sets the filter, a
 * second click clears it; the picked tile has a blurple edge.
 */
export function FilterStrip({ items, value, onChange }: { items: StripItem[]; value: string; onChange: (key: string) => void }) {
  return (
    <div role="group" aria-label="Filter by state" className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
      {items.map((s, i) => {
        const on = value === s.key;
        return (
          <button
            key={s.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? '' : s.key)}
            className={cn(
              'flex min-w-0 flex-col gap-1.5 rounded-md border-1.5 bg-surface-raised px-4 pb-3.5 pt-4 text-left transition-colors',
              on ? 'border-brand shadow-[0_0_0_3px_oklch(var(--brand-soft))]' : 'border-line hover:border-line-strong',
              i === items.length - 1 && items.length % 2 === 1 && 'col-span-2 md:col-span-1',
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] font-medium text-ink-2">
              <s.Icon className="h-[15px] w-[15px] flex-none text-ink-muted" strokeWidth={1.6} aria-hidden />
              <span className="truncate">{s.label}</span>
            </span>
            <span className={cn('text-[26px] font-medium leading-none tracking-[-0.01em] tabular-nums text-ink', s.value > 0 && s.valueClass)}>
              {s.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** The count badge after a card title. */
export function CountBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 items-center rounded-sm bg-brand-soft px-1.5 text-[12px] font-medium text-brand-text">{n}</span>
  );
}

export interface RailItem {
  key: string;
  title: string;
  sub: string;
  right?: ReactNode;
  rightClass?: string;
  href?: string;
}

/** Rail card: full-width rows with a title, a client line and a date or chip on the right. */
export function RailCard({ title, items, empty = 'None' }: { title: string; items: RailItem[]; empty?: string }) {
  return (
    <DashSection title={title} meta={<CountBadge n={items.length} />} bodyClassName="p-0">
      {items.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-ink-faint">{empty}</p>
      ) : (
        <ul>
          {items.map((x) => {
            const inner = (
              <>
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-medium text-ink">{x.title}</b>
                  <span className="block truncate text-[12px] text-ink-muted">{x.sub}</span>
                </span>
                {x.right ? <span className={cn('flex-none whitespace-nowrap text-[13px]', x.rightClass ?? 'text-ink-2')}>{x.right}</span> : null}
              </>
            );
            return (
              <li key={x.key} className="border-t border-line-soft first:border-t-0">
                {x.href ? (
                  <Link href={x.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-sunken/60">
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashSection>
  );
}

/** Boxes with a chevron between: the progress flow of the work in view. */
export function FlowCard({ title, steps }: { title: string; steps: Array<{ label: string; value: number }> }) {
  return (
    <DashSection title={title} bodyClassName="px-3 py-4">
      <div className="flex items-stretch">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            {i > 0 ? <ChevronRight className="h-2.5 w-2.5 flex-none self-center text-ink-faint" strokeWidth={1.6} aria-hidden /> : null}
            <div className="grid min-w-0 flex-1 place-items-center content-center gap-0.5 rounded-md bg-surface-sunken px-0.5 py-2.5 text-center">
              <b className="text-[18px] font-medium tabular-nums text-ink">{s.value}</b>
              <span className="text-[11px] leading-tight text-ink-muted">{s.label}</span>
            </div>
          </Fragment>
        ))}
      </div>
    </DashSection>
  );
}

/** A labelled fact for a record head: a muted key over a 15px value. */
export function Fact({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <em className="block text-[12.5px] not-italic text-ink-muted">{k}</em>
      <b className={cn('block whitespace-nowrap text-[15px] font-medium text-ink', className)}>{children}</b>
    </div>
  );
}
