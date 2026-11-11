'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { useExpiries, useMarkRenewed, type ExpiryItem } from '@/hooks/use-expiries';
import { STATUS_TILE, tileParts } from '@/lib/compliance/spectrum-status';
import { daysLeftLabel, expiryCalendarStatus } from '@/lib/expiries/model';
import { cn } from '@/lib/utils';

/** Expired items stay listed until renewed; later ones show this many days ahead. */
export const EXPIRY_CARD_DAYS = 90;
const MAX_ROWS = 8;

const TONE: Record<ReturnType<typeof expiryCalendarStatus>, ChipTone> = {
  overdue: 'bad',
  'due-soon': 'warn',
  upcoming: 'idle',
  filed: 'ok',
};

/** The chip tone of an expiry's "days left": red once expired, amber within 30 days. */
export function expiryTone(daysLeft: number): ChipTone {
  return TONE[expiryCalendarStatus(daysLeft)];
}

/** The items a calendar shows: not renewed, expired or expiring within `days`, soonest first. */
export function openExpiries(items: readonly ExpiryItem[] | undefined, days = EXPIRY_CARD_DAYS): ExpiryItem[] {
  return (items ?? []).filter((x) => !x.renewedAt && x.daysLeft <= days).sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));
}

/**
 * EXPIRIES ON THE CALENDAR — the one card every role's compliance calendar shows in its rail:
 * DSCs, DIR-3 KYC and registration licences that lapse, from the dates typed on the checklist
 * steps (GET /api/expiries, scoped by the repository). Staff may mark an item renewed, with the
 * new expiry date when there is one; a client only reads.
 */
export function ExpiriesCard({
  engagementId,
  showCompany,
  mayRenew,
  className,
}: {
  /** One client, or the whole scope when empty. */
  engagementId?: string | null;
  showCompany: boolean;
  mayRenew: boolean;
  /** The rail's own card class (the staff `surface`, the client portal's rail card). */
  className?: string;
}) {
  const query = useExpiries({ engagementId: engagementId || null });
  const all = openExpiries(query.data);
  const rows = all.slice(0, MAX_ROWS);
  return (
    <section className={cn('px-4 pb-1.5 pt-3.5', className)} aria-label="Expiries">
      <div className="mb-1 flex items-center gap-2 border-b border-line-soft pb-2">
        <h2 className="flex-1 text-[13px] font-medium text-ink">Expiries</h2>
        <span className="text-[11px] tabular-nums text-ink-muted">{all.length}</span>
      </div>
      {query.isPending ? (
        <p className="py-3 text-[13px] text-ink-faint">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-3 text-[13px] text-ink-faint">Nothing expires in the next {EXPIRY_CARD_DAYS} days</p>
      ) : (
        <ul>
          {rows.map((x) => (
            <ExpiryRow key={x.id} item={x} showCompany={showCompany} mayRenew={mayRenew} />
          ))}
        </ul>
      )}
      {all.length > rows.length ? <p className="pb-2 text-[12px] text-ink-muted">{all.length - rows.length} more later</p> : null}
    </section>
  );
}

function ExpiryRow({ item, showCompany, mayRenew }: { item: ExpiryItem; showCompany: boolean; mayRenew: boolean }) {
  const status = expiryCalendarStatus(item.daysLeft);
  const { day, month } = tileParts(item.expiresOn);
  const [renewing, setRenewing] = useState(false);
  const [newDate, setNewDate] = useState('');
  const renew = useMarkRenewed();
  return (
    <li className="border-t border-line-soft py-2.5 first:border-t-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={cn('grid h-12 w-11 flex-none place-content-center rounded-md text-center leading-none', STATUS_TILE[status])} aria-hidden>
          <b className="text-[18px] font-bold">{day}</b>
          <small className="mt-1 text-[11px] font-semibold opacity-85">{month}</small>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            {item.kindLabel} · {item.subjectName}
          </span>
          <span className="block truncate text-[12px] text-ink-muted">
            {[showCompany && item.subjectName !== item.companyName ? item.companyName : null, item.referenceLabel].filter(Boolean).join(' · ') || ' '}
          </span>
        </span>
        <Chip tone={expiryTone(item.daysLeft)} className="h-5 min-w-0 flex-none gap-1.5 px-1.5 text-[11.5px]">
          {daysLeftLabel(item.daysLeft)}
        </Chip>
      </div>
      {mayRenew ? (
        renewing ? (
          <form
            className="mt-2 flex items-center gap-1.5 pl-[54px]"
            onSubmit={(e) => {
              e.preventDefault();
              renew.mutate({ id: item.id, newExpiresOn: newDate || null }, { onSuccess: () => setRenewing(false) });
            }}
          >
            <Input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              aria-label="New expiry date"
              title="The renewed expiry date. Leave it blank when it will not expire again."
              className="h-8 min-w-0 flex-1 text-[13px]" />
            <Button type="submit" size="sm" className="h-8" disabled={renew.isPending}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setRenewing(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <button type="button" className="mt-1 pl-[54px] text-[12px] font-medium text-brand-text hover:underline" onClick={() => setRenewing(true)}>
            Mark renewed
          </button>
        )
      ) : null}
      {renew.isError ? <p className="mt-1 pl-[54px] text-[12px] text-danger">Could not save. Try again.</p> : null}
    </li>
  );
}
