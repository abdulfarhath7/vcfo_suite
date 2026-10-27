'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import { surfaceCssVars } from '@/lib/shell/shell-appearance';
import { DashHeroSettings } from '@/components/dash/DashHeroSettings';
import { ClientLocaleNowLabel } from '@/hooks/use-client-locale-date';
import { CardHeadTile } from '@/components/common/CardHeadTile';

/**
 * THE greeting card. One component, one look, every dashboard: lead, manager,
 * firm admin, super admin and client all render this (K-07, rules R-17, R-18).
 *
 * Anatomy, top to bottom, does not vary by role:
 *   1. a navy band: the live local time and the settings popover, the name or
 *      greeting, an optional line under it, and the actions (children);
 *   2. a white number strip: each number has a 30px tinted icon tile that comes
 *      from its label, 12px gap, and the label above the number.
 *
 * The headline numbers belong in that strip. Do not add a band of metric cards
 * under the hero: it prints the same numbers twice. The old progress ring is
 * shown as one more number in the strip, so callers that pass `ring` keep the
 * information without the decoration.
 *
 * The band's skin (solid / gradient / custom image), ambient motion and
 * reduced motion still come from `useShellAppearance`.
 */

export type DashHeroStat = {
  label: string;
  value: number | string;
  href?: string;
  /** Paint the value in the danger colour when it demands attention. */
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
  /** The big line: a greeting or the page's identity. */
  title: string;
  /** Extra chips appended after the time, on the top line. */
  meta?: ReactNode;
  /** Small line under the title (scope, state, who owns it). */
  subtitle?: ReactNode;
  stats?: DashHeroStat[];
  /** Shown as one more number in the strip (no ring is drawn). */
  ring?: { value: number; total?: number; caption: string; display?: string };
  /** Actions, placed at the right of the band. */
  children?: ReactNode;
}) {
  const { hero, motion, reduceMotion } = useShellAppearance();
  const showAmbient = motion === 'ambient' && !reduceMotion && !hero.image;
  const strip: DashHeroStat[] = [
    ...(stats ?? []),
    ...(ring ? [{ label: sentence(ring.caption), value: ring.display ?? ring.value }] : []),
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface-raised">
      <div
        className="lead-hero rounded-none px-5 pb-4 pt-4 shadow-none sm:px-6"
        data-hero-image={hero.image ? 'true' : 'false'}
        style={{ ...surfaceCssVars(hero, 'hero'), borderRadius: 0 }}
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

        <div className="relative z-[2] flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-medium text-side-muted">
              <ClientLocaleNowLabel />
              {meta}
            </p>
            <h1 className="mt-1 min-w-0 break-words text-[20px] font-semibold leading-7 tracking-[-0.01em] text-on-navy">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] leading-snug text-side-muted">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {children}
            <DashHeroSettings />
          </div>
        </div>
      </div>

      {strip.length > 0 ? (
        <div className="grid min-w-0 grid-cols-2 gap-x-4 px-5 sm:flex sm:flex-wrap sm:gap-x-0 sm:px-6">
          {strip.map((stat, i) => {
            const body = (
              <>
                <CardHeadTile title={stat.label} size={30} />
                <span className="flex min-w-0 flex-col">
                  <span className="text-[12px] text-ink-muted">{stat.label}</span>
                  <span
                    className={cn(
                      'text-[20px] font-semibold leading-6 tabular-nums tracking-[-0.01em]',
                      stat.hot ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {stat.value}
                  </span>
                </span>
              </>
            );
            const statClass = cn(
              'inline-flex min-w-0 items-center gap-3 py-3 sm:pr-6',
              i < strip.length - 1 && 'sm:mr-6 sm:border-r sm:border-line',
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
      ) : null}
    </section>
  );
}

/** "DONE TODAY" or "done today" becomes "Done today" for the strip label. */
function sentence(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
