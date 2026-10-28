'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD_HEAD_ICONS } from '@/components/common/CardHeadTile';
import { cardHeadIcon } from '@/lib/ui/card-head-icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import type { ChipTone } from '@/components/ui/spectrum-chip';
import { companyInitials } from '@/components/super/parts/super-text';

/**
 * Small parts the super admin screens share (prototype `src/screens/super/parts.tsx` and the
 * KP1 number strip). They are built only from the shared tokens and the shared primitives, so
 * a filter chip or a number tile here reads the same as anywhere else in the product.
 */

/* ---------- Client tile (R-35) ---------- */

const TILE_TONES = [
  'bg-brand-soft text-brand-text',
  'bg-identity-soft text-identity',
  'bg-waiting-soft text-waiting',
  'bg-warning-soft text-warning',
  'bg-positive-soft text-positive',
  'bg-surface-sunken text-ink-2',
];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 26px initials tile in a steady identity colour chosen from the engagement id. */
export function ClientTile({ id, name, className }: { id: string; name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-grid h-[26px] w-[26px] flex-none place-items-center rounded-md text-[10.5px] font-medium',
        TILE_TONES[hashOf(id) % TILE_TONES.length],
        className,
      )}
      aria-hidden
    >
      {companyInitials(name)}
    </span>
  );
}

/** Person initials in a circle (R-44: people avatars are circles). */
export function PersonAvatar({ name, size = 24 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const ini = (parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
  return (
    <span
      className="inline-grid flex-none place-items-center rounded-full bg-surface-sunken text-[10px] font-medium text-ink-2"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {ini}
    </span>
  );
}

/** Name with a muted line under it, for grid cells. */
export function NameCell({ title, sub, lead }: { title: ReactNode; sub?: ReactNode; lead?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {lead}
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink">{title}</span>
        {sub ? <span className="block truncate text-[12px] text-ink-muted">{sub}</span> : null}
      </span>
    </span>
  );
}

/* ---------- R-10 filter chips ---------- */

export interface SuperFilterDef {
  key: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

function FilterMenu({ filter, trigger }: { filter: SuperFilterDef; trigger: ReactNode }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] min-w-[180px] overflow-y-auto">
        {filter.options.length === 0 ? (
          <DropdownMenuItem disabled>None</DropdownMenuItem>
        ) : (
          filter.options.map((option) => (
            <DropdownMenuItem
              key={option}
              onSelect={() => filter.onChange(option)}
              className={cn(option === filter.value && 'font-medium text-brand-text')}
            >
              <span className="min-w-0 flex-1 truncate">{option}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** R-10: a set filter is a soft blurple chip with an ×; an unset one is a dashed "+ Label" chip. */
export function SuperFilterChips({
  filters,
  onClear,
  className,
}: {
  filters: SuperFilterDef[];
  onClear?: () => void;
  className?: string;
}) {
  const any = filters.some((filter) => filter.value);
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {filters.map((filter) =>
        filter.value ? (
          <span
            key={filter.key}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border-1.5 border-brand-line bg-brand-soft pl-2.5 pr-1.5 text-[13px] text-brand-text"
          >
            <FilterMenu
              filter={filter}
              trigger={
                <button type="button" className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                  <span className="text-ink-2">{filter.label}</span>
                  <b className="max-w-[160px] truncate font-medium">{filter.value}</b>
                </button>
              }
            />
            <button
              type="button"
              aria-label={`Remove ${filter.label} filter`}
              onClick={() => filter.onChange('')}
              className="grid h-[18px] w-[18px] place-items-center rounded-sm hover:bg-surface-raised"
            >
              <X size={13} strokeWidth={1.6} aria-hidden />
            </button>
          </span>
        ) : (
          <FilterMenu
            key={filter.key}
            filter={filter}
            trigger={
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-md border-1.5 border-dashed border-line-strong px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-sunken"
              >
                <Plus size={13} strokeWidth={1.6} aria-hidden />
                {filter.label}
              </button>
            }
          />
        ),
      )}
      {any && onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-7 items-center whitespace-nowrap rounded-md border-1.5 border-line bg-surface-raised px-2.5 text-[13px] font-medium text-ink-2 hover:bg-surface-sunken"
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}

/* ---------- KP1 number strip (R-18) ---------- */

export interface SuperStat {
  label: string;
  value: number | string;
  /** Small muted text after the number, for example "/ 30". */
  of?: string;
  sub?: string;
  href?: string;
  /** Overdue number: red. */
  bad?: boolean;
  /** Done number: green. */
  good?: boolean;
}

/** KP1 tiles on a plain page: 13px label with a 15px icon from the label, a 26px number. */
export function SuperNumberStrip({ items }: { items: SuperStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
      {items.map((stat) => {
        const Icon = CARD_HEAD_ICONS[cardHeadIcon(stat.label).icon];
        const body = (
          <span className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-start gap-1.5 text-[13px] font-medium leading-[18px] text-ink-2">
              <Icon width={15} height={15} strokeWidth={1.6} className="mt-px flex-none text-ink-muted" aria-hidden />
              <span className="min-w-0">{stat.label}</span>
            </span>
            <span className="flex items-baseline gap-1">
              <span
                className={cn(
                  'text-[26px] font-medium leading-none tabular-nums',
                  stat.bad ? 'text-danger' : stat.good ? 'text-positive' : 'text-ink',
                )}
              >
                {stat.value}
              </span>
              {stat.of ? <span className="text-[13px] text-ink-muted">{stat.of}</span> : null}
            </span>
            {stat.sub ? <span className="truncate text-[12.5px] text-ink-muted">{stat.sub}</span> : null}
          </span>
        );
        const cls = cn('surface flex min-w-0 px-4 py-3.5', stat.href && 'transition-colors hover:border-line-strong');
        return stat.href ? (
          <Link key={stat.label} href={stat.href} className={cls}>
            {body}
          </Link>
        ) : (
          <div key={stat.label} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Bars (R-25: status colours only) ---------- */

const FILL: Record<ChipTone, string> = {
  ok: 'bg-positive-mid',
  warn: 'bg-warning-mid',
  bad: 'bg-danger-mid',
  prog: 'bg-brand',
  idle: 'bg-upcoming-mid',
  violet: 'bg-identity',
  teal: 'bg-waiting-mid',
};

/** A single progress bar in a status colour. */
export function ToneBar({
  pct,
  tone = 'prog',
  height = 6,
  className,
  label,
}: {
  pct: number;
  tone?: ChipTone;
  height?: number;
  className?: string;
  label?: string;
}) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <span
      className={cn('relative block overflow-hidden rounded-bar bg-surface-sunken', className)}
      style={{ height }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <i className={cn('absolute inset-y-0 left-0 rounded-bar', FILL[tone])} style={{ width: w > 0 ? `max(${w}%, 4px)` : 0 }} />
    </span>
  );
}

export interface SuperSegment {
  label: string;
  value: number;
  tone: ChipTone;
}

/** One stacked bar with its legend (C1 in a line). */
export function StackedBar({
  segments,
  height = 10,
  legend = true,
  className,
}: {
  segments: SuperSegment[];
  height?: number;
  legend?: boolean;
  className?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className={cn('min-w-0', className)}>
      <span
        className="flex w-full gap-0.5 overflow-hidden rounded-bar bg-surface-sunken"
        style={{ height }}
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value}`).join(', ')}
      >
        {total > 0
          ? segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <i key={s.label} className={cn('block h-full', FILL[s.tone])} style={{ flex: s.value }} title={`${s.label} · ${s.value}`} />
              ))
          : null}
      </span>
      {legend ? (
        <ul className="mt-2.5 flex flex-wrap gap-x-3.5 gap-y-1 text-[12.5px] text-ink-2">
          {segments.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5">
              <i className={cn('h-2 w-2 rounded-[2px]', FILL[s.tone])} aria-hidden />
              {s.label}
              <b className="font-medium tabular-nums text-ink">{s.value}</b>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ---------- Page states ---------- */

/** Loading shapes for a super admin page (R-48). */
export function SuperPageSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={label}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="block h-[88px] animate-pulse rounded-md bg-surface-sunken" aria-hidden />
        ))}
      </div>
      <SkeletonRows rows={6} />
    </div>
  );
}

/** A failed read, with the retry. */
export function SuperPageError({ title, error, onRetry }: { title: string; error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      title={
        <span className="flex flex-col gap-1">
          <span className="font-medium text-ink">{title}</span>
          <span className="text-[13px]">{error instanceof Error ? error.message : 'Something went wrong.'}</span>
        </span>
      }
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

/** Plain page head (C-0109): the title and a muted count, no band. */
export function SuperPageHead({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
      <h1 className="min-w-0 text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink">{title}</h1>
      {meta ? <span className="text-[13px] text-ink-muted">{meta}</span> : null}
      {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}
