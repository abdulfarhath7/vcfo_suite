'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { DashHeroSettings } from '@/components/dash/DashHeroSettings';
import { ClientLocaleNowLabel } from '@/hooks/use-client-locale-date';
import { CARD_HEAD_ICONS } from '@/components/common/CardHeadTile';
import { cardHeadIcon } from '@/lib/ui/card-head-icon';

/**
 * THE home card (VCFO Spectrum H3, rules R-17, R-18). One component, one look, every
 * dashboard: lead, manager, firm admin, super admin and client all render this.
 *
 * Anatomy, top to bottom, does not vary by role:
 *   1. the live local time, the greeting or company name, an optional line under it, and the
 *      actions (children) with the settings popover, all on the colour wash;
 *   2. the number tiles (KP1): white at 90%, a 1px white edge and a soft shadow, floating on
 *      the wash. Each tile has a 13px label with a 15px icon from the label, and a 26px number.
 *
 * The headline numbers belong in those tiles. Do not add a band of metric cards under the
 * card: it prints the same numbers twice. The old progress ring is shown as one more tile,
 * so callers that pass `ring` keep the information without the decoration.
 */

export type DashHeroStat = {
  label: string;
  value: number | string;
  href?: string;
  /** Paint the value in the danger colour when it demands attention. */
  hot?: boolean;
  /** Paint the value in the done colour (R-18). */
  good?: boolean;
  /** Small muted line under the number. */
  sub?: string;
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
  /** Shown as one more number tile (no ring is drawn). */
  ring?: { value: number; total?: number; caption: string; display?: string };
  /** Actions, placed at the right of the card. */
  children?: ReactNode;
}) {
  /* The old ring becomes the last number, unless a stat already shows it. A "% complete"
     caption reads "Complete" with the value as a percentage. */
  const ringStat: DashHeroStat | null = ring
    ? ring.caption.trim().startsWith('%')
      ? { label: sentence(ring.caption.replace('%', '')), value: `${ring.display ?? ring.value}%`, good: true }
      : { label: sentence(ring.caption), value: ring.display ?? ring.value, good: true }
    : null;
  const repeats = ringStat && (stats ?? []).some((st) => st.label.trim().toLowerCase() === ringStat.label.toLowerCase());
  const strip: DashHeroStat[] = [...(stats ?? []), ...(ringStat && !repeats ? [ringStat] : [])];

  return (
    <section
      className="bg-wash flex flex-col gap-5 rounded-md border-1.5 border-line px-4 pb-5 pt-[18px] md:px-6 md:pb-6 md:pt-[22px]"
      aria-label="Summary"
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-1">
          <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
            <ClientLocaleNowLabel />
            {meta}
          </p>
          <h1 className="min-w-0 break-words text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink md:text-[28px] md:leading-9">
            {title}
          </h1>
          {subtitle ? (
            <p className="flex min-w-0 items-center gap-1.5 text-[13px] leading-snug text-ink-2">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {children}
          <DashHeroSettings />
        </div>
      </div>

      {strip.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
          {strip.map((stat) => {
            const { icon } = cardHeadIcon(stat.label);
            const Icon = CARD_HEAD_ICONS[icon];
            const body = (
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex items-start gap-1.5 text-[13px] font-medium leading-[18px] text-ink-2">
                  <Icon width={15} height={15} strokeWidth={1.6} className="mt-px flex-none text-ink-muted" aria-hidden />
                  <span className="min-w-0">{capFirst(stat.label)}</span>
                </span>
                <span
                  className={cn(
                    'text-[26px] font-medium leading-none tabular-nums',
                    stat.hot ? 'text-danger' : stat.good ? 'text-positive' : 'text-ink',
                  )}
                >
                  {stat.value}
                </span>
                {stat.sub ? <span className="truncate text-[12.5px] text-ink-muted">{stat.sub}</span> : null}
              </span>
            );
            const tileClass = cn('wash-tile flex min-w-0 items-end gap-2.5 px-4 py-3.5', stat.href && 'transition-colors hover:border-line-strong');
            return stat.href ? (
              <Link key={stat.label} href={stat.href} className={tileClass}>
                {body}
              </Link>
            ) : (
              <span key={stat.label} className={tileClass}>
                {body}
              </span>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

/** Sentence case for a label that arrives in lower case ("projects" becomes "Projects"). */
function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "DONE TODAY" or "done today" becomes "Done today" for the strip label. */
function sentence(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
