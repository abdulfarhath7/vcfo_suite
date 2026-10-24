'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ScrollText } from 'lucide-react';
import { Surface } from '@/components/noir';

/**
 * "Official sources we watch" — the staff-only card on the Announcements
 * page (owner, 2026-10-24). It replaced the "Official RSS feeds" box, which
 * let staff pull a feed straight onto the board with no review. Every
 * official update now takes one road: watcher → review document → manager
 * approves → announcement + Ask VCFO. This card only shows that road.
 */

type Watcher = { id: string; label: string; act: string; homeUrl: string };

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new Error(body?.error || fallback);
  return body as T;
}

export function WatchedSourcesPanel({ reviewPath }: { reviewPath: string }) {
  const watchers = useQuery({
    queryKey: ['ask', 'feeds'],
    queryFn: async () => readJson<{ watchers: Watcher[] }>(await fetch('/api/ask/admin/feeds'), 'Could not load the watched sources'),
    staleTime: 10 * 60_000,
  });
  const pending = useQuery({
    queryKey: ['regulatory-updates', 'pending-count'],
    queryFn: async () =>
      readJson<{ updates: unknown[] }>(await fetch('/api/regulatory-updates?status=pending'), 'Could not load the review queue').then(
        (r) => r.updates.length,
      ),
    staleTime: 60_000,
  });

  return (
    <Surface flat className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-2.5">
        <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-md bg-primary-light text-primary">
          <ScrollText className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">Official sources we watch</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Checked every 30 minutes. A new notification or circular becomes a review document and waits for a manager.
            Once approved it is posted here, everyone is notified, and Ask VCFO answers from it.
          </p>
        </div>
        <Link
          href={reviewPath}
          className="inline-flex min-h-[36px] items-center rounded-[var(--radius-md)] border border-border px-3 text-[12.5px] font-medium text-foreground hover:bg-muted"
        >
          Review queue{typeof pending.data === 'number' ? ` (${pending.data} waiting)` : ''}
        </Link>
      </div>
      <ul className="mt-3 divide-y divide-border/80 border-t border-border/80">
        {watchers.isLoading && <li className="py-2.5 text-[12.5px] text-muted-foreground">Loading…</li>}
        {watchers.isError && (
          <li role="alert" className="py-2.5 text-[12.5px] text-danger-text">
            {(watchers.error as Error).message}
          </li>
        )}
        {(watchers.data?.watchers ?? []).map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[12.5px]">
            <span className="rounded-full bg-primary-light px-2 py-0.5 text-[11px] font-medium text-primary">{w.act}</span>
            <a href={w.homeUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-foreground hover:underline">
              {w.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-muted-foreground">
        MCA notifications are read from the Gazette of India, where the ministry publishes them, because mca.gov.in refuses automated readers.
      </p>
    </Surface>
  );
}
