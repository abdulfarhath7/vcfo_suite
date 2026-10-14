'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight } from 'lucide-react';
import { CardHeading } from '@/components/client/overview/CardHeading';
import type { ClientOverviewActivity } from '@/lib/client-overview';
import { formatClientDate } from '@/components/client/overview/client-overview-format';

/**
 * Module 11 — recent scoped audit.
 *
 * Straight from `audit_events` under the client's own scope, so it can only
 * ever show this engagement. Momentum, not a log dump: five rows, newest first.
 */
/**
 * Consecutive identical events collapse to the latest one plus a count.
 * Three "Client asked for a change on Client Details" rows in a row read as a
 * bug, not as history. Order is preserved — this only merges neighbours.
 */
function collapseRuns(
  activity: ClientOverviewActivity[],
): (ClientOverviewActivity & { count: number })[] {
  const out: (ClientOverviewActivity & { count: number })[] = [];
  for (const event of activity) {
    const previous = out[out.length - 1];
    if (previous && previous.label === event.label) {
      previous.count += 1;
      continue;
    }
    out.push({ ...event, count: 1 });
  }
  return out;
}

export function ClientActivityFeed({ activity }: { activity: ClientOverviewActivity[] }) {
  const rows = collapseRuns(activity).slice(0, 5);

  return (
    <section className="min-w-0" style={{ '--feed': 'var(--accent-violet)' } as CSSProperties}>
      <div className="flex items-center gap-3 px-5 pb-1 pt-4">
        <CardHeading icon={Activity} hue="var(--accent-violet)" title="Recent activity" />
        {rows.length > 0 ? (
          <Link
            href="/app/client/audit"
            className="group ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12px] font-semibold text-foreground transition-colors hover:border-[oklch(var(--feed)/0.4)] hover:text-[oklch(var(--feed))]"
          >
            Full log
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="mx-5 mb-4 mt-3 rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] text-muted-foreground">
          Nothing has been recorded yet.
        </p>
      ) : (
        <ol className="relative px-5 pb-4 pt-3">
          {rows.map((event, index) => (
            <li key={event.id} className="relative flex min-w-0 gap-3 pb-3 last:pb-0">
              {index < rows.length - 1 ? (
                <span
                  className="absolute left-[7px] top-4 h-[calc(100%-8px)] w-0.5 rounded-full bg-[linear-gradient(oklch(var(--feed)/0.45),oklch(var(--feed)/0.1))]"
                  aria-hidden
                />
              ) : null}
              <span
                className={
                  index === 0
                    ? 'client-live relative mt-[3px] h-4 w-4 shrink-0 rounded-full border-[3px] border-[oklch(var(--feed)/0.3)] bg-[oklch(var(--feed))]'
                    : 'relative mt-[3px] h-4 w-4 shrink-0 rounded-full border-2 border-[oklch(var(--feed)/0.55)] bg-panel'
                }
                style={index === 0 ? ({ '--live': 'var(--accent-violet)' } as CSSProperties) : undefined}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-snug text-foreground">
                  {event.label}
                  {event.count > 1 ? (
                    <span className="ml-1.5 rounded-full bg-[oklch(var(--feed)/0.12)] px-1.5 py-px text-[11px] font-bold text-[oklch(var(--feed))]">
                      ×{event.count}
                    </span>
                  ) : null}
                </p>
                <p className="text-[11.5px] tabular-nums text-muted-foreground">
                  {formatClientDate(event.at)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
