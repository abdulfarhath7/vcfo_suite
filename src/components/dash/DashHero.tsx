'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { DashHeroSettings } from '@/components/dash/DashHeroSettings';
import { ClientLocaleNowLabel } from '@/hooks/use-client-locale-date';
import { CARD_HEAD_ICONS } from '@/components/common/CardHeadTile';
import { cardHeadIcon } from '@/lib/ui/card-head-icon';

/**
 * THE home card (VCFO Spectrum "H3 tight", rules R-17 and R-18, owner decision D-17). One
 * component, one look, every dashboard: lead, manager, firm admin, super admin, developer and
 * client all render this. About 160px tall on the colour wash, in two rows:
 *   1. The greeting at 22px with the live date on the same line (staff), or the 36px company
 *      tile, the name, the stage chip and the step count (client, through `lead`, `stage` and
 *      `steps`). The scope switch (`scope`), the actions (children) and the settings popover
 *      sit on the right. On a phone the client name takes the first line and the rest share
 *      the second (M-30).
 *   2. The number tiles (KP1 on the wash): a 14px icon and 12.5px label, the number at 22px, a
 *      12px note, and a 64 x 26 trend line beside the number when `trend` is given (48 x 22 on
 *      phones). Tiles sit in a grid with a 170px minimum; on a phone they go two in a row and an
 *      odd last tile spans both columns as one short line. A tile with `href` is a link to the
 *      list behind it (E-05), `onClick` opens a drill instead, and `how` shows a white "How is
 *      this counted?" card on hover and focus (E-04).
 *
 * The headline numbers belong in those tiles. Do not add a band of metric cards under the
 * card: it prints the same numbers twice. The old progress ring is shown as one more tile,
 * so callers that pass `ring` keep the information without the decoration.
 */

export type DashHeroStat = {
  label: string;
  value: number | string;
  href?: string;
  /** Opens a drill or panel instead of a page (client home). Ignored when `href` is set. */
  onClick?: () => void;
  /** Paint the value in the danger colour when it demands attention. */
  hot?: boolean;
  /** Paint the value in the done colour (R-18). */
  good?: boolean;
  /** Short line under the number ("3 new today", "2 clients"). `note` wins when both are given. */
  sub?: string;
  /** Short line under the number. */
  note?: string;
  /** Trend line points, oldest first, the last one the live count. Drawn only with two or more points. */
  trend?: number[];
  /** Trend colour; by default red for `hot`, green for `good`, blurple otherwise. */
  trendTone?: 'bad' | 'ok' | 'teal' | 'warn' | 'accent';
  /** A small share bar under the number, in percent. */
  bar?: number;
  /** E-04: one sentence on how the number is counted, shown in a white card on hover and focus. */
  how?: string;
};

const TREND: Record<NonNullable<DashHeroStat['trendTone']>, string> = {
  bad: 'text-danger-mid',
  ok: 'text-positive-mid',
  teal: 'text-waiting-mid',
  warn: 'text-warning-mid',
  accent: 'text-brand',
};

export function DashHero({
  title,
  meta,
  subtitle,
  stats,
  ring,
  lead,
  stage,
  steps,
  scope,
  children,
  settings = true,
}: {
  /** The big line: a greeting, or the company's name on the client home. */
  title: string;
  /** Extra chips after the date on the first row. */
  meta?: ReactNode;
  /** Small text after the title row's date (scope, state, who owns it). */
  subtitle?: ReactNode;
  stats?: DashHeroStat[];
  /** Shown as one more number tile (no ring is drawn). */
  ring?: { value: number; total?: number; caption: string; display?: string };
  /** Client home: the company tile before the name (see `DashHeroCompanyTile`). The date is not shown then. */
  lead?: ReactNode;
  /** Client home: the stage chip after the name. */
  stage?: ReactNode;
  /** Client home: the step count after the stage chip ("6 of 25 steps"). */
  steps?: ReactNode;
  /** The scope switch (All / Incorporating / Compliance), on the right of the first row (D-17). */
  scope?: ReactNode;
  /** The main action, on the right of the first row. */
  children?: ReactNode;
  /** Show the greeting card settings popover (staff homes). The client home turns it off. */
  settings?: boolean;
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
  const actions =
    scope || children || settings ? (
      <div className={cn('flex flex-wrap items-center gap-2 sm:gap-2.5', lead && 'ml-auto')}>
        {scope}
        {children}
        {settings ? <DashHeroSettings /> : null}
      </div>
    ) : null;

  return (
    <section className="bg-wash flex flex-col gap-3 rounded-md border-1.5 border-line px-4 pb-4 pt-3.5 md:px-5" aria-label="Summary">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {lead ? (
          // M-30: on a phone the name takes the first line; the chip, step count and actions share the second.
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-2 sm:gap-x-3">
            <span className="flex min-w-0 max-w-full items-center gap-3 max-sm:basis-full">
              {lead}
              <h1 className="min-w-0 truncate text-[22px] font-medium leading-7 tracking-[-0.01em] text-ink">{title}</h1>
            </span>
            {stage}
            {steps ? <span className="whitespace-nowrap text-[12.5px] text-ink-2">{steps}</span> : null}
            {meta ? <span className="flex items-center gap-2 text-[12.5px] text-ink-2">{meta}</span> : null}
            {subtitle ? <span className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-ink-2">{subtitle}</span> : null}
            {actions}
          </div>
        ) : (
          <>
            <div className="flex min-w-0 flex-[1_1_300px] flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="min-w-0 break-words text-[22px] font-medium leading-7 tracking-[-0.01em] text-ink">{title}</h1>
              <span className="whitespace-nowrap text-[12.5px] text-ink-2">
                <ClientLocaleNowLabel />
              </span>
              {meta ? <span className="flex items-center gap-2 self-center text-[12.5px] text-ink-2">{meta}</span> : null}
              {subtitle ? <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-2">{subtitle}</span> : null}
            </div>
            {actions}
          </>
        )}
      </div>

      {strip.length > 0 ? (
        <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={200}>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]">
            {strip.map((stat, i) => (
              <WashTile key={stat.label} stat={stat} strip={strip.length % 2 === 1 && i === strip.length - 1} />
            ))}
          </div>
        </TooltipPrimitive.Provider>
      ) : null}
    </section>
  );
}

/**
 * R-18 (home card tile): KP1 on the wash. A 14px icon and 12.5px label, the number at 22px, a
 * 12px note, and a 64 x 26 trend line beside the number when given (48 x 22 on phones).
 * `strip` is the odd last tile on a phone: it spans both columns as one short line (M-30).
 */
function WashTile({ stat, strip }: { stat: DashHeroStat; strip?: boolean }) {
  const note = stat.note ?? stat.sub;
  const label = capFirst(stat.label);
  const tone = stat.trendTone ?? (stat.hot ? 'bad' : stat.good ? 'ok' : 'accent');
  const Icon = CARD_HEAD_ICONS[cardHeadIcon(stat.label).icon];
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium text-ink-2">
        <Icon width={14} height={14} strokeWidth={1.6} className="flex-none text-ink-muted" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      <span className={cn('flex min-w-0 items-start gap-2 sm:gap-2.5', strip && 'max-sm:flex-none')}>
        <span className={cn('flex min-w-0 flex-1 flex-col gap-1', strip && 'max-sm:flex-row max-sm:items-baseline max-sm:gap-2')}>
          <b
            className={cn(
              'whitespace-nowrap text-[22px] font-medium leading-none tabular-nums',
              strip && 'max-sm:text-[18px]',
              stat.hot ? 'text-danger' : stat.good ? 'text-positive' : 'text-ink',
            )}
          >
            {stat.value}
          </b>
          {stat.bar !== undefined ? (
            <span className="block h-1 w-full max-w-[96px] overflow-hidden rounded-bar bg-surface-sunken" aria-hidden>
              <i className="block h-full rounded-bar bg-positive-mid" style={{ width: `${Math.max(0, Math.min(100, stat.bar))}%` }} />
            </span>
          ) : null}
          {note ? <span className="truncate text-[12px] text-ink-muted">{note}</span> : null}
        </span>
        {stat.trend && stat.trend.length > 1 ? (
          <TrendLine points={stat.trend} className={cn(TREND[tone], strip && 'max-sm:hidden')} />
        ) : null}
      </span>
    </>
  );
  const cls = cn(
    'wash-tile flex min-w-0 flex-col gap-1 px-3 py-2.5 text-left sm:px-3.5',
    strip && 'max-sm:col-span-2 max-sm:flex-row max-sm:items-center max-sm:justify-between max-sm:gap-3 max-sm:py-2',
    (stat.href || stat.onClick) &&
      'transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25',
  );
  const aria = `${label}: ${stat.value}${note ? `, ${note}` : ''}. Open the list`;
  const tile = stat.href ? (
    <Link href={stat.href} className={cls} aria-label={aria}>
      {inner}
    </Link>
  ) : stat.onClick ? (
    <button type="button" onClick={stat.onClick} className={cls} aria-label={aria}>
      {inner}
    </button>
  ) : (
    // A tile with `how` takes focus so keyboard users can open its info card; it does nothing on activation.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <div className={cls} tabIndex={stat.how ? 0 : undefined}>
      {inner}
    </div>
  );
  if (!stat.how) return tile;
  // E-04 (TP2): a white card says how the number is counted and, for a link, that it opens the list (E-05).
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{tile}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-[260px] rounded-md border-1.5 border-line bg-surface-raised px-3 py-2.5 text-[13px] text-ink shadow-float"
        >
          <b className="block text-[12px] font-medium text-ink-muted">How is this counted?</b>
          <span className="mt-0.5 block leading-snug">{stat.how}</span>
          {stat.href || stat.onClick ? (
            <span className="mt-1.5 block text-[12px] font-medium text-brand-text">Click to open the list</span>
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** 64 x 26 trend line (48 x 22 on phones) with a soft area and a dot on the last point. */
function TrendLine({ points, className }: { points: number[]; className?: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const xy = points.map((p, i) => [2 + (i / (points.length - 1)) * 60, 22 - ((p - min) / (max - min || 1)) * 18] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1]!;
  return (
    <svg viewBox="0 0 64 26" className={cn('mb-0.5 h-[22px] w-12 flex-none self-end sm:h-[26px] sm:w-16', className)} aria-hidden>
      <path d={`M2,26 L${line.split(' ').join(' L')} L62,26 Z`} fill="currentColor" fillOpacity=".14" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * The client home's 36px company tile (R-17): a 6px square with the company's initials on the
 * brand tint, or its logo when there is one. Pass it as `lead`.
 */
export function DashHeroCompanyTile({ name, src }: { name: string; src?: string | null }) {
  const initials =
    name
      .replace(/\b(private|pvt|limited|ltd|llp|inc|india)\b\.?/gi, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || name.slice(0, 1).toUpperCase();
  return (
    <span
      className="grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-md bg-brand text-[14px] font-medium text-on-brand shadow-shine"
      aria-hidden
    >
      {src ? (
        // A company logo from our own storage, not a remote CDN, so <img> is correct.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
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
