'use client';

import Link from 'next/link';
import { m, useReducedMotion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cardHover } from '@/lib/motion';
import { internToneBadge } from '@/components/intern/intern-tones';
import type { InternChipTone } from '@/lib/intern-work';

export type LeadMetricAccent = 'primary' | 'danger' | 'sky' | 'success' | 'pink';

const ICON_BG: Record<LeadMetricAccent, string> = {
  primary: 'bg-primary',
  danger: 'bg-danger',
  sky: 'bg-accent-sky',
  success: 'bg-success',
  pink: 'bg-accent-pink',
};

const NUM_COLOR: Record<LeadMetricAccent, string> = {
  primary: 'text-primary-dark',
  danger: 'text-danger-text',
  sky: 'text-accent-sky',
  success: 'text-success-text',
  pink: 'text-accent-pink',
};

export interface LeadMetricBreakdown {
  count: number;
  label: string;
  tone: InternChipTone;
  href?: string;
}

export function LeadMetricCard({
  title,
  value,
  unit,
  accent,
  icon: Icon,
  href,
  breakdown,
}: {
  title: string;
  value: number;
  unit: string;
  accent: LeadMetricAccent;
  icon: LucideIcon;
  href: string;
  breakdown: LeadMetricBreakdown[];
}) {
  const reduceMotion = useReducedMotion();
  const chips = breakdown.some((chip) => chip.count > 0)
    ? breakdown.filter((chip) => chip.count > 0)
    : breakdown;

  return (
    <m.div
      className="h-full min-w-0"
      whileHover={reduceMotion ? undefined : cardHover.whileHover}
      transition={cardHover.transition}
    >
      <div className="lead-metric relative flex h-full min-w-0 flex-col gap-3 p-4 pt-5" data-accent={accent}>
        <Link href={href} className="absolute inset-0 z-0 rounded-[inherit]" aria-label={title} />
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md text-white',
              ICON_BG[accent],
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 truncate text-[13px] font-extrabold text-ink">{title}</span>
        </div>
        <div className="relative z-[1] flex min-w-0 items-center gap-2">
          <div className="shrink-0">
            <div className={cn('serif text-[32px] font-bold leading-none tabular-nums xl:text-[36px]', NUM_COLOR[accent])}>
              {value}
            </div>
            <div className="mt-1 text-[11px] font-extrabold uppercase tracking-[0.04em] text-text-tertiary">
              {unit}
            </div>
          </div>
          <div
            className="lead-metric-chips"
            style={{ ['--lead-chip-n' as string]: chips.length }}
          >
            {chips.map((chip) => {
              const body = (
                <>
                  <span className="serif text-[17px] font-bold leading-none tabular-nums">{chip.count}</span>
                  <span className="w-full truncate text-[8.5px] font-extrabold uppercase tracking-tight opacity-85" title={chip.label}>
                    {chip.label}
                  </span>
                </>
              );
              const className = cn('lead-metric-chip relative z-[1]', internToneBadge(chip.tone));
              if (chip.href) {
                return (
                  <Link key={chip.label} href={chip.href} className={className}>
                    {body}
                  </Link>
                );
              }
              return (
                <span key={chip.label} className={className}>
                  {body}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </m.div>
  );
}
