'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FilterSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { toastError } from '@/lib/toast-errors';
import type { PeopleDto } from '@/lib/receivables/v2-wire';
import { cn } from '@/lib/utils';
import { HOURS, ROW_BTN, WEEKDAYS, errorText, hourLabel, stamp, type PeopleActions, type SaveSettings } from './shared';

/**
 * The Leaders sub-tab: the weekly leadership digest switch, weekday and hour on one line, the
 * typed-in recipients as dense rows, and a one-line add form.
 */
export function LeadersPane({ people, act, saveSettings }: { people: PeopleDto; act: PeopleActions; saveSettings: SaveSettings }) {
  const s = people.settings;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-raised">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-surface-sunken px-3 py-1.5 text-[12.5px]">
        <span className="inline-flex items-center gap-1.5">
          <Switch id="rcv-sw-digest" checked={s.digestEnabled} onCheckedChange={(v) => saveSettings({ digestEnabled: v })} />
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
      <ul aria-label="Digest recipients">
        {people.digestRecipients.map((r) => (
          <li key={r.id} className="flex h-7 items-center gap-2.5 border-b border-line-soft px-3 text-[12.5px]">
            <Switch
              checked={r.active}
              onCheckedChange={(v) => act.updateRecipient.mutate({ id: r.id, active: v }, { onError: (e) => toastError('Not saved', errorText(e)) })}
              aria-label={`Send the digest to ${r.name}`}
            />
            <span className={cn('font-medium', !r.active && 'text-ink-faint')}>{r.name}</span>
            <span className="min-w-0 flex-1 truncate text-ink-muted">{r.email}</span>
            <Button size="iconSm" variant="quiet" className="!h-6 !w-6" aria-label={`Remove ${r.name}`} onClick={() => act.removeRecipient.mutate(r.id, { onError: (e) => toastError('Not removed', errorText(e)) })}>
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
        {!people.digestRecipients.length ? <li className="border-b border-line-soft px-3 py-1.5 text-[12.5px] text-ink-muted">No recipients yet.</li> : null}
      </ul>
      <form
        className="flex flex-wrap items-center gap-2 px-3 py-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !email.trim()) return;
          act.addRecipient.mutate({ name: name.trim(), email: email.trim() }, { onSuccess: () => (setName(''), setEmail('')), onError: (err) => toastError('Not added', errorText(err)) });
        }}
      >
        <Input className="h-7 min-w-[160px] flex-1 text-[12.5px]" aria-label="Recipient name" placeholder="Name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        <Input className="h-7 min-w-[200px] flex-1 text-[12.5px]" aria-label="Recipient email" placeholder="Email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" size="sm" variant="secondary" className={ROW_BTN} disabled={!name.trim() || !email.trim() || act.addRecipient.isPending}>
          <Plus aria-hidden />
          Add recipient
        </Button>
      </form>
    </div>
  );
}
