'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';
import { DashHeroSettings } from '@/components/dash/DashHeroSettings';
import { ClientLocaleNowLabel } from '@/hooks/use-client-locale-date';

/**
 * THE home card (VCFO Spectrum H3c, rules R-17 and R-18, owner decision D-01). One component,
 * one look, every dashboard: lead, manager, firm admin, super admin and client all render this.
 *
 * One compact row, about 84px tall, on the colour wash. It wraps on phones.
 *   1. Left: the live local time and the greeting (staff), or a 40px company tile, the short
 *      name, the stage chip and the step count (client, through `lead`, `stage` and `steps`).
 *   2. Middle: the mini tiles. Each is 56px: a 12px muted label, a 20px number and a short 12px
 *      note, with a 52 x 24 trend line on the right when `trend` is given (hidden when the tile
 *      is narrow). No icons. A tile with `href` is a link to the list behind the number (E-05);
 *      a tile with `how` shows a white "How is this counted?" card on hover and focus (E-04).
 *   3. Right: the actions (children) and the settings popover.
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
  /** Short note after the number ("3 new", "2 clients"). `note` wins when both are given. */
  sub?: string;
  /** Short note after the number. */
  note?: string;
  /** Trend line points, oldest first. Drawn only when given with two or more points. */
  trend?: number[];
  /** Trend colour; by default red for `hot`, green for `good`, blurple otherwise. */
  trendTone?: 'bad' | 'ok' | 'teal' | 'warn' | 'accent';
  /** A 44px share bar after the number, in percent. */
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
  children,
}: {
  /** The big line: a greeting, or the company's short name on the client home. */
  title: string;
  /** Extra chips appended after the time, on the top line. */
  meta?: ReactNode;
  /** Small line under the title (scope, state, who owns it). */
  subtitle?: ReactNode;
  stats?: DashHeroStat[];
  /** Shown as one more number tile (no ring is drawn). */
  ring?: { value: number; total?: number; caption: string; display?: string };
  /** Client home: the 40px company tile before the name (see `DashHeroCompanyTile`). The date line is not shown then. */
  lead?: ReactNode;
  /** Client home: the stage chip under the name. */
  stage?: ReactNode;
  /** Client home: the step count after the stage chip ("6 of 25 steps"). */
  steps?: ReactNode;
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
  const underLine = stage || steps || subtitle;

  return (
    <section
      className="bg-wash flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-md border-1.5 border-line py-3.5 pl-4 pr-3 md:pl-5 md:pr-4"
      aria-label="Summary"
    >
      <div className="mr-1 flex min-w-0 max-w-full flex-none items-center gap-3">
        {lead}
        <div className="flex min-w-0 flex-col gap-[3px]">
          {lead ? null : (
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink-2">
              <ClientLocaleNowLabel />
              {meta}
            </p>
          )}
          <h1 className="min-w-0 truncate text-[20px] font-medium leading-tight tracking-[-0.01em] text-ink">{title}</h1>
          {lead && meta ? <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-[12.5px] text-ink-2">{meta}</p> : null}
          {underLine ? (
            <p className="flex min-w-0 max-w-[420px] items-center gap-2 text-[12.5px] leading-snug text-ink-2">
              {stage}
              {steps ? <span className="flex-none whitespace-nowrap">{steps}</span> : null}
              {subtitle ? <span className="flex min-w-0 items-center gap-1.5 truncate">{subtitle}</span> : null}
            </p>
          ) : null}
        </div>
      </div>

      {strip.length > 0 ? (
        <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={200}>
          <div className="flex min-w-0 flex-[999_1_520px] flex-wrap gap-2">
            {strip.map((stat) => (
              <MiniTile key={stat.label} stat={stat} />
            ))}
          </div>
        </TooltipPrimitive.Provider>
      ) : null}

      <div className="ml-auto flex flex-none items-center gap-2">
        {children}
        <DashHeroSettings />
      </div>
    </section>
  );
}

/**
 * R-18 (home card tile): 56px. A 12px label, a 20px number and a short 12px note on the left;
 * a 52 x 24 trend line on the right when given, or a 44px bar for a share. The tile is a size
 * container, so the trend line hides when the tile is narrower than 168px.
 */
function MiniTile({ stat }: { stat: DashHeroStat }) {
  const note = stat.note ?? stat.sub;
  const label = capFirst(stat.label);
  const tone = stat.trendTone ?? (stat.hot ? 'bad' : stat.good ? 'ok' : 'accent');
  const inner = (
    <span className="flex h-full min-w-0 items-center gap-2">
      <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px]">
        <span className="truncate text-[12px] font-medium text-ink-muted">{label}</span>
        <span className="flex min-w-0 items-baseline gap-1.5">
          <b
            className={cn(
              'whitespace-nowrap text-[20px] font-medium leading-none tabular-nums',
              stat.hot ? 'text-danger' : stat.good ? 'text-positive' : 'text-ink',
            )}
          >
            {stat.value}
          </b>
          {note ? <span className="truncate text-[12px] text-ink-muted">{note}</span> : null}
          {stat.bar !== undefined ? (
            <span className="ml-0.5 block h-[5px] w-11 flex-none self-center overflow-hidden rounded-bar bg-surface-sunken" aria-hidden>
              <i className="block h-full rounded-bar bg-positive-mid" style={{ width: `${Math.max(0, Math.min(100, stat.bar))}%` }} />
            </span>
          ) : null}
        </span>
      </span>
      {stat.trend && stat.trend.length > 1 ? (
        <TrendLine points={stat.trend} className={cn('[@container_(max-width:168px)]:hidden', TREND[tone])} />
      ) : null}
    </span>
  );
  const cls = cn(
    'wash-tile block h-14 min-w-[104px] flex-[1_1_120px] pl-3 pr-2.5 [container-type:inline-size]',
    stat.href && 'transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25',
  );
  const tile = stat.href ? (
    <Link href={stat.href} className={cls} aria-label={`${label}: ${stat.value}${note ? `, ${note}` : ''}. Open the list`}>
      {inner}
    </Link>
  ) : (
    // A tile with `how` takes focus so keyboard users can open its info card; it does nothing on activation.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <span className={cls} tabIndex={stat.how ? 0 : undefined}>
      {inner}
    </span>
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
          {stat.href ? <span className="mt-1.5 block text-[12px] font-medium text-brand-text">Click to open the list</span> : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** 52 x 24 trend line with a soft area and a dot on the last point. */
function TrendLine({ points, className }: { points: number[]; className?: string }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const xy = points.map((p, i) => [2 + (i / (points.length - 1)) * 48, 20 - ((p - min) / (max - min || 1)) * 16] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1]!;
  return (
    <svg width="52" height="24" viewBox="0 0 52 24" className={cn('flex-none', className)} aria-hidden>
      <path d={`M2,24 L${line.split(' ').join(' L')} L50,24 Z`} fill="currentColor" fillOpacity=".14" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="currentColor" />
    </svg>
  );
}

/**
 * The client home's 40px company tile (R-17): a 6px square with the company's initials on the
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
      className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-md bg-brand text-[15px] font-medium text-on-brand shadow-shine"
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
