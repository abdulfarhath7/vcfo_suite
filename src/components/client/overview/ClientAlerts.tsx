'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, BellRing, CalendarCheck2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardHeading } from '@/components/client/overview/CardHeading';
import { GlossaryText } from '@/components/ask/GlossaryTerm';
import { AskAboutThis } from '@/components/ask/AskAboutThis';
import {
  ALERT_WINDOW_DAYS,
  alertDueLabel,
  alertsWithin,
  buildClientAlerts,
  type AlertWindowDays,
  type ClientAlert,
} from '@/lib/client-alerts';
import type { ClientOverviewComplianceItem, ClientOverviewNeed } from '@/lib/client-overview';
import { CardTabs, type CardTab } from '@/components/client/overview/CardTabs';

const LIST_LIMIT = 5;
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'UTC' });

function tone(alert: ClientAlert) {
  if (alert.daysLeft < 0) {
    return {
      tile: 'bg-danger text-white shadow-[0_6px_14px_-8px_oklch(var(--danger))]',
      chip: 'bg-danger-light text-danger-text',
      row: 'border-danger/35 bg-[linear-gradient(90deg,oklch(var(--danger)/0.08),transparent_60%)]',
    };
  }
  if (alert.daysLeft <= 7) {
    return {
      tile: 'bg-warning text-white shadow-[0_6px_14px_-8px_oklch(var(--warning))]',
      chip: 'bg-warning-light text-warning-text',
      row: 'border-warning/35 bg-[linear-gradient(90deg,oklch(var(--warning)/0.08),transparent_60%)]',
    };
  }
  return { tile: 'bg-muted text-foreground', chip: 'bg-muted text-muted-foreground', row: 'border-border' };
}

function actionLabel(alert: ClientAlert): string {
  if (alert.kind === 'filing') return 'View';
  return alert.daysLeft < 0 ? 'Fix' : 'Open';
}

/**
 * IMPORTANT ALERTS — overdue items first, then whatever falls due in the next
 * 15 or 30 days: the client's own dated steps and statutory filings.
 */
export function ClientAlerts({
  needs,
  upcoming,
  now,
}: {
  needs: ClientOverviewNeed[];
  upcoming: ClientOverviewComplianceItem[];
  now?: Date;
}) {
  const alerts = useMemo(
    () => buildClientAlerts(needs, upcoming, now ?? new Date()),
    [needs, upcoming, now],
  );
  const tabs = useMemo<CardTab<`${AlertWindowDays}`>[]>(
    () =>
      ALERT_WINDOW_DAYS.map((days) => ({
        id: `${days}` as const,
        label: `${days} days`,
        count: alertsWithin(alerts, days).length,
        hue: days === ALERT_WINDOW_DAYS[0] ? 'var(--warning)' : 'var(--accent-orange)',
      })),
    [alerts],
  );
  const [tab, setTab] = useState<`${AlertWindowDays}`>(`${ALERT_WINDOW_DAYS[0]}`);
  const rows = alertsWithin(alerts, Number(tab));
  const shown = rows.slice(0, LIST_LIMIT);
  const overdue = alerts.filter((alert) => alert.daysLeft < 0).length;

  return (
    <section className="min-w-0" aria-label="Important alerts">
      <div className="flex items-center gap-2 px-5 pb-1 pt-4">
        <CardHeading icon={BellRing} hue={overdue > 0 ? 'var(--danger)' : 'var(--warning)'} title="Important alerts">
          {overdue > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white" style={{ '--live': 'var(--danger)' } as CSSProperties}>
              <span className="client-live h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
              {overdue} overdue
            </span>
          ) : null}
        </CardHeading>
        <AskAboutThis question="Which deadlines are coming up for my company, and what happens if one is missed?" className="ml-auto" />
      </div>
      <div className="px-5 pb-4 pt-3">
        <CardTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Alert window" />
        {shown.length === 0 ? (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-success-light px-3 py-2.5">
            <CalendarCheck2 className="h-5 w-5 shrink-0 text-success-text" strokeWidth={2} aria-hidden />
            <p className="text-[12.5px] font-medium leading-snug text-success-text">
              No deadlines in the next {tab} days. Deadlines will show up here first.
            </p>
          </div>
        ) : (
          <ul role="tabpanel" className="mt-3 space-y-1.5">
            {shown.map((alert) => {
              const colors = tone(alert);
              const date = new Date(`${alert.dueDate.slice(0, 10)}T00:00:00Z`);
              return (
                <li key={alert.id} className={cn('flex items-center gap-2.5 rounded-lg border px-2.5 py-2', colors.row)}>
                  <span
                    className={cn(
                      'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg leading-none',
                      colors.tile,
                    )}
                    aria-hidden
                  >
                    <span className="text-[16px] font-bold tabular-nums">{date.getUTCDate()}</span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide">
                      {MONTH.format(date)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">
                      <GlossaryText text={alert.title} />
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                      <span className="truncate">{alert.meta}</span>
                      <span className={cn('shrink-0 rounded-sm px-1 py-px text-[10.5px] font-semibold', colors.chip)}>
                        {alertDueLabel(alert.daysLeft)}
                      </span>
                    </span>
                  </span>
                  <Link
                    href={alert.href}
                    className={cn(
                      'group inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      alert.daysLeft < 0
                        ? 'bg-danger text-white shadow-[0_6px_14px_-8px_oklch(var(--danger))] hover:opacity-90'
                        : 'border border-border bg-panel text-foreground hover:bg-muted',
                    )}
                  >
                    {actionLabel(alert)}
                    <span className="sr-only"> {alert.title}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
            {rows.length > shown.length ? (
              <li className="pt-2 text-[12px]">
                <Link href="/app/client/compliances/calendar" className="font-semibold text-primary hover:underline">
                  +{rows.length - shown.length} more on the calendar
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </section>
  );
}
