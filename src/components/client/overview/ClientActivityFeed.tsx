'use client';

import Link from 'next/link';
import { Mono } from '@/components/noir';
import { ClientCard } from '@/components/client/overview/ClientCard';
import type { ClientOverviewActivity } from '@/lib/client-overview';
import { formatClientDate } from '@/components/client/overview/client-overview-format';

/**
 * Module 11 — recent scoped audit.
 *
 * Straight from `audit_events` under the client's own scope, so it can only
 * ever show this engagement. Momentum, not a log dump: eight rows, newest first.
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
  return (
    <ClientCard
      title="Recent activity"
      action={
        <Link
          href="/app/client/audit"
          className="text-[11.5px] font-bold text-primary hover:underline"
        >
          Full log
        </Link>
      }
    >
      {activity.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground">Nothing yet.</p>
      ) : (
        <ol className="space-y-2.5">
          {collapseRuns(activity)
            .slice(0, 8)
            .map((event) => (
              <li key={event.id} className="flex min-w-0 gap-2.5">
                <span
                  className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug text-ink">
                    {event.label}
                    {event.count > 1 ? (
                      <span className="ml-1.5 text-muted-foreground">×{event.count}</span>
                    ) : null}
                  </p>
                  <Mono className="text-[10.5px] tabular-nums text-muted-foreground">
                    {formatClientDate(event.at)}
                  </Mono>
                </div>
              </li>
            ))}
        </ol>
      )}
    </ClientCard>
  );
}
