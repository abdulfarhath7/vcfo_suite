'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashSection } from '@/components/dash/DashSection';
import { Checkbox } from '@/components/ui/checkbox';
import { SkeletonRows } from '@/components/ui/empty-state';
import type { BeforeFilingLine } from '@/data/before-filing';
import { errorMessage, toastError } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * Two cards of the staff obligation and registration records, both on migration 0028:
 *  - `FilingThreadCard` (S-771): the dated two-sided thread of a filing period. Client events
 *    sit left, SBC events right, the date on the spine. Events come from `filing_events`,
 *    written where a filing is filed or reopened, a proof is uploaded and a window moves.
 *  - `BeforeFilingCard` (S-783, S-816): the "Before filing" ticks, staff only. The lines are
 *    static data (`src/data/before-filing.ts`); a tick is stored per engagement.
 */

interface FilingEventDto {
  id: string;
  instanceId: string;
  side: 'client' | 'sbc';
  label: string;
  actorName: string | null;
  at: string;
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function spineDate(iso: string): { dow: string; day: string } {
  const d = new Date(iso);
  const ist = new Date(d.getTime() + 330 * 60_000);
  return { dow: DOW[ist.getUTCDay()]!, day: `${ist.getUTCDate()} ${MON[ist.getUTCMonth()]}` };
}

export function FilingThreadCard({
  instanceIds,
  companyOf,
  title = 'This period',
}: {
  instanceIds: string[];
  /** When several clients share the period, each event names its client. */
  companyOf?: Map<string, string>;
  title?: string;
}) {
  const ids = useMemo(() => [...new Set(instanceIds)].sort(), [instanceIds]);
  const q = useQuery({
    queryKey: ['filing-events', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const res = await fetch(`/api/filings/events?ids=${ids.join(',')}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load the events');
      return ((await res.json()) as { events: FilingEventDto[] }).events;
    },
    staleTime: 30_000,
  });
  const events = q.data ?? [];

  return (
    <DashSection title={title} meta={events.length ? `${events.length}` : undefined} bodyClassName="p-0">
      {q.isPending && ids.length ? (
        <div className="p-4">
          <SkeletonRows rows={3} />
        </div>
      ) : events.length === 0 ? (
        <p className="px-4 py-3 text-[13px] text-ink-faint">Nothing recorded yet</p>
      ) : (
        <ol className="relative px-4 py-3" aria-label={title}>
          <span className="absolute inset-y-3 left-1/2 w-px -translate-x-1/2 bg-line" aria-hidden />
          {events.map((e) => {
            const { dow, day } = spineDate(e.at);
            const who = [companyOf?.get(e.instanceId), e.actorName].filter(Boolean).join(' · ');
            const body = (
              <span className="block min-w-0">
                <b className="block text-[13.5px] font-medium text-ink">{e.label}</b>
                {who ? <span className="block truncate text-[12px] text-ink-muted">{who}</span> : null}
              </span>
            );
            return (
              <li key={e.id} className="relative grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-2 py-1.5">
                <span className={cn('text-right', e.side !== 'client' && 'invisible')} aria-hidden={e.side !== 'client'}>
                  {e.side === 'client' ? body : null}
                </span>
                <span className="relative z-[1] mx-auto grid w-[64px] place-items-center rounded-md bg-surface-raised py-0.5 text-center leading-tight">
                  <span className="text-[11px] text-ink-muted">{dow}</span>
                  <span className="text-[12.5px] font-medium tabular-nums text-ink">{day}</span>
                </span>
                <span className={cn(e.side !== 'sbc' && 'invisible')} aria-hidden={e.side !== 'sbc'}>
                  {e.side === 'sbc' ? body : null}
                </span>
                <span className="sr-only">{e.side === 'client' ? 'Client' : 'SBC'}</span>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex justify-between border-t border-line-soft px-4 py-2 text-[11.5px] font-medium text-ink-muted" aria-hidden>
        <span>Client</span>
        <span>SBC</span>
      </div>
    </DashSection>
  );
}

interface TickDto {
  itemKey: string;
  checkedBy: string | null;
  checkedAt: string;
}

export function BeforeFilingCard({
  engagementId,
  kind,
  subjectKey,
  lines,
}: {
  engagementId: string;
  kind: 'obligation' | 'registration';
  subjectKey: string;
  lines: BeforeFilingLine[];
}) {
  const queryClient = useQueryClient();
  const key = ['compliance-checklist', engagementId, kind, subjectKey];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const qs = new URLSearchParams({ engagementId, kind, key: subjectKey });
      const res = await fetch(`/api/compliance-checklist?${qs}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not load the checklist');
      return ((await res.json()) as { ticks: TickDto[] }).ticks;
    },
    staleTime: 30_000,
  });
  const ticks = new Map((q.data ?? []).map((t) => [t.itemKey, t]));
  const set = useMutation({
    mutationFn: async ({ item, checked }: { item: string; checked: boolean }) => {
      const res = await fetch('/api/compliance-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagementId, kind, key: subjectKey, item, checked }),
      });
      if (!res.ok) throw new Error('Could not save the tick');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (e) => toastError('Could not save the tick', errorMessage(e)),
  });
  const done = lines.filter((l) => ticks.has(l.key)).length;

  return (
    <DashSection title="Before filing" meta={`Staff only · ${done} of ${lines.length}`} bodyClassName="p-0">
      <ul>
        {lines.map((l) => {
          const tick = ticks.get(l.key);
          const id = `bf-${kind}-${subjectKey}-${l.key}`;
          return (
            <li key={l.key} className="flex items-start gap-2.5 border-t border-line-soft px-4 py-2.5 first:border-t-0">
              <Checkbox
                id={id}
                className="mt-0.5"
                checked={Boolean(tick)}
                disabled={q.isPending || set.isPending}
                onCheckedChange={(v) => set.mutate({ item: l.key, checked: v === true })}
              />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className={cn('block text-[13.5px]', tick ? 'text-ink-muted' : 'text-ink')}>{l.label}</span>
                {tick?.checkedBy ? <span className="block text-[12px] text-ink-faint">{tick.checkedBy}</span> : null}
              </label>
            </li>
          );
        })}
      </ul>
    </DashSection>
  );
}
