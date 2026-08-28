'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared dashboard hero — the lead dashboard's gradient greeting card,
 * generalised. Left: greeting + date. Right: a headline ring stat.
 * Bottom: translucent stat chips that deep-link into the app.
 *
 * Uses the same `.lead-hero` surface (defaults to the primary→violet→pink
 * gradient when no per-user hero skin is set).
 */

export function DashHeroRing({
  value,
  total,
  caption,
}: {
  value: number;
  /** Ring fills value/total; omit for a full ring. */
  total?: number;
  caption: string;
}) {
  const pct = !total || total <= 0 ? 1 : Math.min(1, value / total);
  const c = 2 * Math.PI * 18;
  return (
    <div
      className="flex shrink-0 flex-col items-center"
      role="img"
      aria-label={`${value}${total ? ` of ${total}` : ''} ${caption}`}
    >
      <svg width="52" height="52" viewBox="0 0 44 44" aria-hidden>
        <circle cx="22" cy="22" r="18" fill="none" stroke="rgb(255 255 255 / 0.16)" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r="18"
          fill="none"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={`${pct * c} ${c}`}
          transform="rotate(-90 22 22)"
        />
        <text
          x="22"
          y="26"
          textAnchor="middle"
          fill="white"
          fontSize="11"
          fontWeight="700"
          fontFamily="var(--font-serif)"
        >
          {value}
        </text>
      </svg>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-white/55">
        {caption}
      </p>
    </div>
  );
}

export type DashHeroStat = {
  label: string;
  value: number | string;
  href?: string;
  /** Paint the value red-ish when it demands attention. */
  hot?: boolean;
};

export function DashHero({
  title,
  kicker,
  stats,
  ring,
  children,
}: {
  /** The big line — a greeting or the page's identity. */
  title: string;
  /** Small line above the title (date, scope). */
  kicker?: string;
  stats?: DashHeroStat[];
  /** Right-side ring; render anything else via children instead. */
  ring?: { value: number; total?: number; caption: string };
  children?: ReactNode;
}) {
  return (
    <section className="lead-hero px-5 py-4 sm:px-6 sm:py-5">
      <div className="relative z-[2] flex items-start justify-between gap-4">
        <div className="min-w-0">
          {kicker ? (
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/65">
              {kicker}
            </p>
          ) : null}
          <h1 className="mt-1 truncate text-[1.55rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.75rem]">
            {title}
          </h1>
        </div>
        {ring ? <DashHeroRing value={ring.value} total={ring.total} caption={ring.caption} /> : null}
        {children}
      </div>

      {stats && stats.length > 0 ? (
        <div className="relative z-[2] mt-4 flex flex-wrap gap-2">
          {stats.map((stat) => {
            const body = (
              <>
                <span
                  className={cn(
                    'text-[17px] font-bold leading-none tabular-nums',
                    stat.hot ? 'text-rose-200' : 'text-white',
                  )}
                >
                  {stat.value}
                </span>
                <span className="text-[11px] font-semibold text-white/70">{stat.label}</span>
              </>
            );
            const chipClass = cn(
              'inline-flex items-baseline gap-1.5 rounded-full bg-white/12 px-3 py-1.5',
              'ring-1 ring-white/15 backdrop-blur-[2px]',
              stat.href && 'transition-colors hover:bg-white/20',
            );
            return stat.href ? (
              <Link key={stat.label} href={stat.href} className={chipClass}>
                {body}
              </Link>
            ) : (
              <span key={stat.label} className={chipClass}>
                {body}
              </span>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
