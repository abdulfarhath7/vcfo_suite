'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { toastError } from '@/lib/toast-errors';
import type { PeopleDto } from '@/lib/receivables/v2-wire';
import { cn } from '@/lib/utils';
import { HOURS, ROW_BTN, WEEKDAYS, errorText, hourLabel, stamp, type PeopleActions, type SaveSettings } from './shared';

/**
 * The Leaders sub-tab: the weekly leadership digest switch, weekday and hour on one line, then a
 * "Leaders" header with a + that opens the add form (as on the Partners list), and the typed-in
 * leaders as rows.
 */
export function LeadersPane({ people, act, saveSettings }: { people: PeopleDto; act: PeopleActions; saveSettings: SaveSettings }) {
  const s = people.settings;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-raised">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface-sunken px-4 py-2.5 text-[13px]">
        <span className="inline-flex items-center gap-1.5">
          <Switch size="sm" id="rcv-sw-digest" checked={s.digestEnabled} onCheckedChange={(v) => saveSettings({ digestEnabled: v })} />
          <label htmlFor="rcv-sw-digest" className="cursor-pointer font-medium">
            Weekly digest
          </label>
        </span>
        <FilterSelect aria-label="Digest weekday" value={String(s.digestWeekday)} onChange={(e) => saveSettings({ digestWeekday: Number(e.target.value) })} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} />
        <FilterSelect aria-label="Digest hour" value={String(s.digestHourIst)} onChange={(e) => saveSettings({ digestHourIst: Number(e.target.value) })} options={HOURS.map((h) => ({ value: String(h), label: hourLabel(h) }))} />
        <span className="text-ink-muted">
          {'Next: '}
          <b className="font-medium text-ink">{people.nextDigestAt ? stamp(people.nextDigestAt) : 'Off'}</b>
        </span>
        <span className="text-[11.5px] text-ink-muted">Partner ▸ client ▸ open invoices, with totals. Sent from the sheet manager&apos;s Outlook.</span>
      </div>
      {/* The same header and + as the Partners list (owner, 17 Nov 2026): + opens the add form. */}
      <div className="flex h-10 items-center justify-between border-b border-line bg-surface-sunken pl-4 pr-2">
        <span className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-muted">{`Leaders · ${people.digestRecipients.filter((r) => r.active).length} active`}</span>
        <Button size="iconSm" variant="quiet" className="!h-7 !w-7" aria-label={adding ? 'Close the add leader form' : 'Add a leader'} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
          {adding ? <X aria-hidden /> : <Plus aria-hidden />}
        </Button>
      </div>
      {adding ? (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-sunken px-4 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !email.trim()) return;
            act.addRecipient.mutate(
              { name: name.trim(), email: email.trim() },
              { onSuccess: () => (setName(''), setEmail(''), setAdding(false)), onError: (err) => toastError('Not added', errorText(err)) },
            );
          }}
        >
          <Input className="h-8 min-w-[160px] flex-1 text-[13px]" aria-label="Leader name" placeholder="Name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          <Input className="h-8 min-w-[200px] flex-1 text-[13px]" aria-label="Leader email" placeholder="Email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="sm" className={ROW_BTN} disabled={!name.trim() || !email.trim() || act.addRecipient.isPending}>
            <Plus aria-hidden />
            Add leader
          </Button>
        </form>
      ) : null}
      <ul aria-label="Digest recipients">
        {people.digestRecipients.map((r) => (
          <li key={r.id} className="flex h-10 items-center gap-3 border-b border-line-soft px-4 text-[13px]">
            <Switch
              size="sm"
              checked={r.active}
              onCheckedChange={(v) => act.updateRecipient.mutate({ id: r.id, active: v }, { onError: (e) => toastError('Not saved', errorText(e)) })}
              aria-label={`Send the digest to ${r.name}`}
            />
            <span className={cn('font-medium', !r.active && 'text-ink-faint')}>{r.name}</span>
            <span className="min-w-0 flex-1 truncate text-ink-muted">{r.email}</span>
            <Button size="iconSm" variant="quiet" className="!h-7 !w-7" aria-label={`Remove ${r.name}`} onClick={() => act.removeRecipient.mutate(r.id, { onError: (e) => toastError('Not removed', errorText(e)) })}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
        {!people.digestRecipients.length ? <li className="px-4 py-3 text-[13px] text-ink-muted">No leaders yet. Click + to add one.</li> : null}
      </ul>
    </div>
  );
}
