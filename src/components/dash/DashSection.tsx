'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type IconChipTone } from '@/components/common/IconChip';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { CardLoadBody } from '@/components/ui/card-load';

/**
 * Shared dashboard section card, every role (K-06, rules R-15 and R-16): a
 * surface panel with a 52px head, a hairline under it, a 28px tinted icon tile
 * that comes from the title, and a 15px/500 sentence-case title (VCFO Spectrum). Optional
 * right-side meta or "view all" link; content below. The `icon`, `tone` and
 * `size` props are still accepted so callers compile, but the tile now follows
 * the title so one kind of card looks the same on every portal.
 */
export function DashSection({
  title,
  meta,
  href,
  hrefLabel,
  className,
  bodyClassName,
  loading,
  loadingVariant = 'rows',
  children,
}: {
  /** Kept for callers; the tile icon now comes from the title. */
  icon?: LucideIcon;
  /** Kept for callers; the tile tone now comes from the title. */
  size?: 'md' | 'lg';
  /** Kept for callers; the tile tone now comes from the title. */
  tone?: IconChipTone;
  title: string;
  /** Small right-aligned text (counts, scope). */
  meta?: ReactNode;
  /** Right-aligned link, rendered after meta. */
  href?: string;
  hrefLabel?: string;
  className?: string;
  bodyClassName?: string;
  /** L1 (B-19): grey shapes cover the body while the card's data loads. Pass the real loading flag. */
  loading?: boolean;
  /** The shapes: list rows (default) or a summary block. */
  loadingVariant?: 'rows' | 'block';
  children: ReactNode;
}) {
  return (
    <section className={cn('surface min-w-0 overflow-hidden', className)}>
      <div className="flex min-h-[52px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft px-4 py-2">
        <CardHeadTile title={title} />
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{title}</h2>
        {meta ? (
          <span className="min-w-0 max-w-full text-[12.5px] text-ink-muted">{meta}</span>
        ) : null}
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-brand-text hover:underline"
          >
            {hrefLabel ?? 'View all'}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
      </div>
      <CardLoadBody loading={loading} variant={loadingVariant} className={cn('px-4 pb-3 pt-3', bodyClassName)}>
        {children}
      </CardLoadBody>
    </section>
  );
}

/** Donut for small distributions — the lead side rail's chart, generalised. */
export function DashDonut({
  segments,
  centerLabel,
  centerCaption,
  size = 106,
}: {
  segments: Array<{ n: number; className?: string; color?: string }>;
  centerLabel: string | number;
  centerCaption: string;
  size?: number;
}) {
  const total = Math.max(
    1,
    segments.reduce((sum, s) => sum + s.n, 0),
  );
  const c = 2 * Math.PI * 15.9;
  let offset = c * 0.25;
  return (
    <svg width={size} height={size} viewBox="0 0 42 42" className="shrink-0" aria-hidden>
      {segments.map((seg, i) => {
        const dash = (seg.n / total) * c;
        const el = (
          <circle
            key={i}
            cx="21"
            cy="21"
            r="15.9"
            fill="none"
            stroke={seg.color ?? 'currentColor'}
            className={seg.className}
            strokeWidth="6.4"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
          />
        );
        offset -= dash;
        return el;
      })}
      <text
        x="21"
        y="20.5"
        textAnchor="middle"
        fontSize="8.5"
        fontWeight="600"
        fill="oklch(var(--ink))"
        fontFamily="var(--font-sans)"
      >
        {centerLabel}
      </text>
      <text
        x="21"
        y="27.5"
        textAnchor="middle"
        fontSize="4.2"
        fill="oklch(var(--ink-muted))"
        fontFamily="var(--font-sans)"
      >
        {centerCaption}
      </text>
    </svg>
  );
}

/** Legend row next to a donut. */
export function DashLegendRow({
  swatchClassName,
  label,
  count,
}: {
  swatchClassName: string;
  label: string;
  count: number;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2 truncate text-[12px] font-medium text-ink-muted">
      <i className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-sm', swatchClassName)} />
      {label} · {count}
    </span>
  );
}
