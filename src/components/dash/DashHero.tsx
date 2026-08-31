'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useShellAppearance } from '@/lib/use-shell-appearance';
import { surfaceCssVars } from '@/lib/shell-appearance';
import { DashHeroSettings } from '@/components/dash/DashHeroSettings';
import { ClientLocaleNowLabel } from '@/hooks/use-client-locale-date';

/**
 * THE greeting card. One component, one look, every dashboard — lead, manager,
 * firm admin, super admin and client all render this.
 *
 * Anatomy, top to bottom, is the lead dashboard's and does not vary by role:
 *   1. the live local time on the left, the settings popover on the right,
 *   2. serif title, with an optional line under it, and an optional ring,
 *   3. a white hairline,
 *   4. the stat strip — serif value + small label, hairline separators.
 *
 * The headline numbers belong in that strip. Do not add a band of metric cards
 * under the hero: it prints the same numbers twice and is the drift the client
 * dashboard was called out for.
 *
 * Hero skin (solid / gradient / custom image), ambient motion and reduced
 * motion all come from `useShellAppearance`, so a user's greeting-card
 * preference follows them across every dashboard rather than applying to one.
 */

export function DashHeroRing({
  value,
  total,
  caption,
  display,
}: {
  value: number;
  /** Ring fills value/total; omit for a full ring. */
  total?: number;
  caption: string;
  /** Text inside the ring when it should differ from `value` (e.g. "85%"). */
  display?: string;
}) {
  const pct = !total || total <= 0 ? 1 : Math.min(1, value / total);
  const c = 2 * Math.PI * 18;
  return (
    <div
      className="flex shrink-0 flex-col items-center"
      role="img"
      aria-label={`${display ?? value}${total ? ` of ${total}` : ''} ${caption}`}
    >
      <svg width="52" height="52" viewBox="0 0 44 44" className="shrink-0" aria-hidden>
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
          className="transition-[stroke-dasharray] duration-700 ease-out"
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
          {display ?? value}
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
  /** Paint the value at full strength when it demands attention. */
  hot?: boolean;
};

export function DashHero({
  title,
  meta,
  subtitle,
  stats,
  ring,
  children,
}: {
  /** The big line — a greeting or the page's identity. */
  title: string;
  /** Extra chips appended after the time, on the top line. */
  meta?: ReactNode;
  /** Small line under the title (scope, state, who owns it). */
  subtitle?: ReactNode;
  stats?: DashHeroStat[];
  /** Right-side ring; render anything else via children instead. */
  ring?: { value: number; total?: number; caption: string; display?: string };
  children?: ReactNode;
}) {
  const { hero, motion, reduceMotion } = useShellAppearance();
  const showAmbient = motion === 'ambient' && !reduceMotion && !hero.image;

  return (
    <section
      className="lead-hero px-5 py-4 sm:px-6 sm:py-5"
      data-hero-image={hero.image ? 'true' : 'false'}
      style={surfaceCssVars(hero, 'hero')}
    >
      {showAmbient ? (
        <div className="lead-hero-fx" aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className={i % 3 === 0 ? 'twinkle' : ''}
              style={{
                left: `${(i * 37 + 11) % 100}%`,
                width: 4 + (i % 3),
                height: 4 + (i % 3),
                borderRadius: '50%',
                background: `rgba(255,255,255,${0.22 + (i % 5) * 0.06})`,
                animationDuration: `${5 + (i % 5) * 0.8}s`,
                animationDelay: `${-((i * 0.41) % 6)}s`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative z-[2]">
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] font-medium tracking-[0.04em] text-white/65">
            <ClientLocaleNowLabel />
            {meta}
          </p>
          <DashHeroSettings />
        </div>

        <div className="mt-1 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="serif min-w-0 break-words text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-white [text-shadow:0_1px_16px_rgb(15_23_42_/_0.35)] sm:text-[1.95rem]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] leading-snug text-white/85">
                {subtitle}
              </p>
            ) : null}
          </div>
          {ring ? (
            <DashHeroRing
              value={ring.value}
              total={ring.total}
              caption={ring.caption}
              display={ring.display}
            />
          ) : null}
          {children}
        </div>
      </div>

      {stats && stats.length > 0 ? (
        <>
          <div className="relative z-[2] mt-3.5 h-px bg-white/12" />
          <div className="relative z-[2] mt-2.5 flex min-w-0 flex-wrap items-baseline gap-y-1 text-white">
            {stats.map((stat, i) => {
              const body = (
                <>
                  <span
                    className={cn(
                      'serif text-[1.05rem] font-semibold leading-none tabular-nums',
                      stat.hot ? 'text-white' : 'text-white/95',
                    )}
                  >
                    {stat.value}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium tracking-wide',
                      stat.hot ? 'text-white/90' : 'text-white/58',
                    )}
                  >
                    {stat.label}
                  </span>
                </>
              );
              const statClass = cn(
                'inline-flex items-baseline gap-1.5 py-0.5 pr-3.5 text-[12px]',
                i > 0 && 'border-l border-white/20 pl-3.5',
                stat.href && 'transition-opacity hover:opacity-80',
              );
              return stat.href ? (
                <Link key={stat.label} href={stat.href} className={statClass}>
                  {body}
                </Link>
              ) : (
                <span key={stat.label} className={statClass}>
                  {body}
                </span>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
