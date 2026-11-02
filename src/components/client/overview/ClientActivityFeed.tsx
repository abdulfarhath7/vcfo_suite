'use client';

import Link from 'next/link';
import { Mono } from '@/components/noir';
import { ClientCard } from '@/components/client/overview/ClientCard';
import type { ClientOverviewActivity } from '@/lib/client/client-overview';
import { formatClientDate } from '@/components/client/overview/client-overview-format';

/**
 * Module 11 — recent scoped audit.
 *
 * Straight from `audit_events` under the client's own scope, so it can only
 * ever show this engagement. Momentum, not a log dump: the latest five rows, newest first, in
 * a fixed height (owner item C1); "View all" opens the Audit page.
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

/** C1: rows shown before the "View all" link. */
const ACTIVITY_ROWS = 5;

export function ClientActivityFeed({ activity }: { activity: ClientOverviewActivity[] }) {
  return (
    <ClientCard
      title="Recent activity"
      action={
        <Link
          href="/app/client/audit"
          className="text-[11.5px] font-semibold text-brand hover:underline"
        >
          View all
        </Link>
      }
    >
      {activity.length === 0 ? (
        <p className="h-[220px] text-[12.5px] text-ink-muted">Nothing yet.</p>
      ) : (
        <ol className="h-[220px] space-y-2.5 overflow-hidden">
          {collapseRuns(activity)
            .slice(0, ACTIVITY_ROWS)
            .map((event) => (
              <li key={event.id} className="flex min-w-0 gap-2.5">
                <span
                  className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand/40"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] leading-snug text-ink" title={event.label}>
                    {event.label}
                    {event.count > 1 ? (
                      <span className="ml-1.5 text-ink-muted">×{event.count}</span>
                    ) : null}
                  </p>
                  <Mono className="text-[10.5px] tabular-nums text-ink-muted">
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
