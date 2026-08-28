'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_BG, type IconChipTone } from '@/components/common/IconChip';

/**
 * Shared dashboard section card — the lead dashboard's card anatomy:
 * a `surface` panel headed by a solid color icon tile + small uppercase title,
 * optional right-side meta or "view all" link, content below.
 */
export function DashSection({
  icon: Icon,
  tone = 'primary',
  title,
  meta,
  href,
  hrefLabel,
  className,
  bodyClassName,
  children,
}: {
  icon: LucideIcon;
  tone?: IconChipTone;
  title: string;
  /** Small right-aligned text (counts, scope). */
  meta?: ReactNode;
  /** Right-aligned link, rendered after meta. */
  href?: string;
  hrefLabel?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('surface min-w-0 overflow-hidden', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 px-4 pt-3">
        <span
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white',
            TONE_BG[tone],
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold uppercase tracking-[0.06em] text-ink">
          {title}
        </h2>
        {meta ? (
          <span className="shrink-0 text-[11.5px] font-semibold text-text-tertiary">{meta}</span>
        ) : null}
        {href ? (
          <Link
            href={href}
            className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-primary hover:underline"
          >
            {hrefLabel ?? 'View all'}
            <ArrowUpRight className="h-3 w-3" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className={cn('px-4 pb-3 pt-2.5', bodyClassName)}>{children}</div>
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
            strokeLinecap="round"
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
        fontWeight="700"
        fill="oklch(var(--ink))"
        fontFamily="var(--font-serif)"
      >
        {centerLabel}
      </text>
      <text
        x="21"
        y="27.5"
        textAnchor="middle"
        fontSize="4.2"
        fill="oklch(var(--muted-foreground))"
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
    <span className="flex min-w-0 items-center gap-2 truncate text-[12px] font-bold text-muted-foreground">
      <i className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-sm', swatchClassName)} />
      {label} · {count}
    </span>
  );
}
