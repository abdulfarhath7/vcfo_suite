'use client';

import Link from 'next/link';
import { History } from 'lucide-react';
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
export function ClientActivityFeed({ activity }: { activity: ClientOverviewActivity[] }) {
  return (
    <ClientCard
      title="Recent activity"
      icon={History}
      tone="neutral"
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
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Nothing recorded yet. Every action on your file — a document delivered,
          a filing made — shows up here as it happens.
        </p>
      ) : (
        <ol className="space-y-2.5">
          {activity.slice(0, 8).map((event) => (
            <li key={event.id} className="flex min-w-0 gap-2.5">
              <span
                className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold leading-snug text-ink">{event.label}</p>
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
