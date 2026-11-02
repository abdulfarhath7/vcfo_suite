'use client';

import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToneBar } from '@/components/super/parts/super-parts';
import { formatSuperAgo } from '@/components/super/overview/super-overview-format';
import type { ChipTone } from '@/components/ui/spectrum-chip';
import type { LoadValue } from '@/lib/metrics/filing-metrics';
import type { PersonMetrics } from '@/lib/metrics/practice-metrics';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import { usePeopleMetrics, useSetCapacity } from '@/components/metrics/use-metrics';
import { cn } from '@/lib/utils';

/**
 * Cells for the managers and project leads grids (G-14): On time, Load against capacity,
 * Last active and the capacity editor. Every value comes from `/api/metrics/people`.
 */

const LOAD_TONE: Record<LoadValue['tone'], ChipTone> = { ok: 'prog', warn: 'warn', bad: 'bad', none: 'idle' };

/** "92%" over the filings filed in the last 12 months, or a dash with nothing filed. */
export function OnTimeCell({ person }: { person: PersonMetrics | undefined }) {
  const pct = person?.onTime.pct ?? null;
  return (
    <span
      className={cn('tabular-nums', pct === null ? 'text-ink-faint' : pct < 80 ? 'font-medium text-danger' : undefined)}
      title={person && person.onTime.filed ? `${person.onTime.onTime} of ${person.onTime.filed} filed on time in the last 12 months` : undefined}
    >
      {pct === null ? '–' : `${pct}%`}
    </span>
  );
}

/** Open items against capacity as a bar and "12 / 20". Without a capacity, the open count. */
export function LoadCell({ person, className }: { person: PersonMetrics | undefined; className?: string }) {
  if (!person) return <span className="text-ink-faint">–</span>;
  const { load } = person;
  return (
    <span className={cn('flex items-center gap-2', className)} title={`${load.open} open items`}>
      {load.pct !== null ? (
        <ToneBar pct={load.pct} tone={LOAD_TONE[load.tone]} className="w-16 flex-none" />
      ) : null}
      <span className={cn('whitespace-nowrap text-[12.5px] tabular-nums', load.tone === 'bad' ? 'font-medium text-danger' : 'text-ink-muted')}>
        {load.capacity ? `${load.open} / ${load.capacity}` : `${load.open} open`}
      </span>
    </span>
  );
}

/** When the person last used the app (`profiles.last_seen_at`). */
export function LastSeenCell({ person }: { person: PersonMetrics | undefined }) {
  const seen = person?.lastSeenAt;
  return <span className={cn('whitespace-nowrap', !seen && 'text-ink-faint')}>{seen ? formatSuperAgo(seen) : 'Not yet'}</span>;
}

/**
 * The capacity editor: a quiet trigger with the current capacity that opens a small number
 * field. Render it only for admin and super admin; the route and the repository refuse
 * everyone else.
 */
export function CapacityControl({ person }: { person: PersonMetrics }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(person.capacity ? String(person.capacity) : '');
  const mutation = useSetCapacity();
  const parsed = value.trim() === '' ? null : Number(value);
  const valid = parsed === null || (Number.isInteger(parsed) && parsed >= 1 && parsed <= 500);

  const save = async (capacity: number | null) => {
    try {
      await mutation.mutateAsync({ profileId: person.profileId, capacity });
      toastSuccess(capacity === null ? 'Capacity cleared' : 'Capacity saved', person.name, { id: `capacity:${person.profileId}` });
      setOpen(false);
    } catch (err) {
      toastError('Could not save capacity', errorMessage(err, 'Try again.'));
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setValue(person.capacity ? String(person.capacity) : '');
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px] tabular-nums text-ink-muted transition-colors hover:border-brand/40 hover:text-ink',
            person.capacity && 'border-solid',
          )}
          aria-label={`Capacity for ${person.name}`}
        >
          <Gauge className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {person.capacity ? person.capacity : 'Set'}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[15rem] p-3" onClick={(e) => e.stopPropagation()}>
        <label htmlFor={`capacity-${person.profileId}`} className="mb-2 block text-[12px] font-semibold text-ink">
          Capacity · open items
        </label>
        <Input
          id={`capacity-${person.profileId}`}
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9"
        />
        {!valid ? <p className="mt-1.5 text-[11px] text-danger">A whole number from 1 to 500.</p> : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          {person.capacity ? (
            <Button type="button" size="sm" variant="ghost" className="mr-auto text-ink-muted" disabled={mutation.isPending} onClick={() => void save(null)}>
              Clear
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={mutation.isPending || !valid || parsed === null} onClick={() => void save(parsed)}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * On time, load and last active as record stats for one person (admin People, manager
 * drill-down), with the capacity editor for admin and super admin. Renders nothing until the
 * metrics arrive or when the caller may not read them.
 */
export function PersonMetricStats({ profileId, canSetCapacity }: { profileId: string; canSetCapacity: boolean }) {
  const query = usePeopleMetrics();
  const person = query.data?.find((p) => p.profileId === profileId);
  if (!person) return null;
  return (
    <>
      <span className="flex items-baseline gap-1.5">
        <b className="text-[20px] font-medium tabular-nums text-ink">{person.onTime.pct === null ? '–' : `${person.onTime.pct}%`}</b>
        <span className="text-[13px] text-ink-muted">on time</span>
      </span>
      <span className="flex items-center gap-2 text-[13px] text-ink-muted">
        <LoadCell person={person} />
        load
      </span>
      <span className="text-[13px] text-ink-muted">
        Last active <LastSeenCell person={person} />
      </span>
      {canSetCapacity ? <CapacityControl person={person} /> : null}
    </>
  );
}
