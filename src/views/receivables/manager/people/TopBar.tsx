'use client';

import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/native-select';
import { PopoverCard } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import type { PeopleDto } from '@/lib/receivables/v2-wire';
import type { OutlookStatusDto } from '@/lib/receivables/wire';
import { cn } from '@/lib/utils';
import { OUTLOOK_CONNECT_HREF } from '../ComposeSummary';
import { HOURS, shortHour, stamp, type SaveSettings } from './shared';

/**
 * The People tab's strip of sheet-wide email switches (new invoice, revised,
 * and the roll-up days and hour) with the next roll-up time, then the Outlook and WhatsApp
 * status as two small dots. Each dot opens a pop-over with the details and its action.
 */

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Monday first, as the firm's week runs. */
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function EmailSwitches({ people, saveSettings }: { people: PeopleDto; saveSettings: SaveSettings }) {
  const s = people.settings;
  const days = s.rollupWeekdays?.length ? s.rollupWeekdays : [1, 4];
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-line bg-surface-raised px-4 py-2.5 text-[13px]" role="group" aria-label="Sheet email switches">
      <span className="font-medium text-ink">Automatic emails</span>
      <SwitchItem id="rcv-sw-new" label="New" title="New invoice emails" checked={s.emailNewInvoiceEnabled} onChange={(v) => saveSettings({ emailNewInvoiceEnabled: v })} />
      <SwitchItem id="rcv-sw-revised" label="Revised" title="Revised invoice emails" checked={s.emailRevisedEnabled} onChange={(v) => saveSettings({ emailRevisedEnabled: v })} />
      <span className="inline-flex items-center gap-1.5">
        <SwitchItem id="rcv-sw-rollup" label="Roll-up on" title="Roll-up emails to partners" checked={s.emailRollupEnabled} onChange={(v) => saveSettings({ emailRollupEnabled: v })} />
        {/* The weekdays the roll-up goes out on (owner, 17 Nov 2026); at least one stays picked. */}
        <span role="group" aria-label="Roll-up days" className="inline-flex overflow-hidden rounded-md border border-line">
          {DAY_ORDER.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={DAY_NAMES[d]}
                title={DAY_NAMES[d]}
                onClick={() => {
                  const next = on ? days.filter((x) => x !== d) : [...days, d];
                  if (next.length) saveSettings({ rollupWeekdays: next.sort() });
                }}
                className={cn('h-7 w-8 border-l border-line text-[12px] font-medium first:border-l-0', on ? 'bg-brand text-on-brand' : 'bg-surface-raised text-ink-2 hover:bg-hover')}
              >
                {DAY_NAMES[d].slice(0, 2)}
              </button>
            );
          })}
        </span>
        <span className="text-ink-muted">at</span>
        <FilterSelect className="!h-7 !text-[12.5px]" aria-label="Roll-up hour (IST)" value={String(s.sendHourIst)} onChange={(e) => saveSettings({ sendHourIst: Number(e.target.value) })} options={HOURS.map((h) => ({ value: String(h), label: shortHour(h) }))} />
      </span>
      <span className="ml-auto whitespace-nowrap text-[12px] text-ink-muted" title="The next roll-up and leadership digest, India time">
        {`Next roll-up ${people.nextRollupAt ? stamp(people.nextRollupAt) : 'off'} · digest ${people.nextDigestAt ? stamp(people.nextDigestAt) : 'off'}`}
      </span>
    </div>
  );
}

function SwitchItem({ id, label, title, checked, onChange }: { id: string; label: string; title: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={title}>
      <label htmlFor={id} className="cursor-pointer">
        {label}
      </label>
      <Switch size="sm" id={id} checked={checked} onCheckedChange={onChange} />
    </span>
  );
}

const DOT = { ok: 'bg-positive', warn: 'bg-warning', off: 'bg-ink-faint' } as const;

function StatusDot({ tone, label, detail }: { tone: keyof typeof DOT; label: string; detail: string }) {
  return (
    <button type="button" className="inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[12.5px] text-ink-2 hover:bg-surface-sunken" aria-label={`${label}: ${detail}. Show details`}>
      <span className={cn('size-2 rounded-full', DOT[tone])} aria-hidden />
      {label}
    </button>
  );
}

export function Integrations({
  outlook,
  whatsapp,
  settingsHref,
  onTest,
  testing,
}: {
  outlook: OutlookStatusDto | undefined;
  whatsapp: PeopleDto['whatsapp'];
  settingsHref: string;
  onTest: () => void;
  testing: boolean;
}) {
  const waTone = !whatsapp.configured ? 'warn' : whatsapp.myPhone ? 'ok' : 'off';
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Integrations">
      <PopoverCard
        title="Outlook"
        width={280}
        align="end"
        trigger={<StatusDot tone={outlook?.connected ? 'ok' : 'warn'} label="Outlook" detail={outlook?.connected ? 'connected' : 'not connected'} />}
      >
        <div className="flex flex-col gap-2 px-4 py-3 text-[12.5px]">
          {outlook?.connected ? (
            <p>
              {'Connected as '}
              <b className="font-medium">{outlook.msEmail}</b>
            </p>
          ) : (
            <p className="text-ink-2">Not connected. Emails you approve, send or retry go from your own Outlook.</p>
          )}
          {!outlook?.connected && outlook?.configured ? (
            <Button size="sm" variant="strong" asChild>
              <a href={OUTLOOK_CONNECT_HREF}>Connect Outlook</a>
            </Button>
          ) : null}
        </div>
      </PopoverCard>
      <PopoverCard
        title="WhatsApp (DoubleTick)"
        width={300}
        align="end"
        trigger={<StatusDot tone={waTone} label="WhatsApp" detail={!whatsapp.configured ? 'not set up' : whatsapp.myPhone ? 'configured' : 'no phone number'} />}
      >
        <div className="flex flex-col gap-2 px-4 py-3 text-[12.5px]">
          <p className="text-ink-2">After every receivables email from your Outlook, WhatsApp tells you what went out.</p>
          {!whatsapp.configured ? <p className="text-warning">{`Not set up. The server needs ${whatsapp.missing.join(' and ')}.`}</p> : null}
          <p className="text-ink-2">
            {'Your number: '}
            <b className="font-mono font-medium text-ink">{whatsapp.myPhone ?? 'not set'}</b>
            {' · '}
            <a href={settingsHref} className="font-medium text-brand-text hover:underline">
              {whatsapp.myPhone ? 'Change in Account settings' : 'Add it in Account settings'}
            </a>
          </p>
          <Button size="sm" variant="secondary" disabled={!whatsapp.configured || !whatsapp.myPhone || testing} onClick={onTest}>
            <Send aria-hidden />
            Send test message
          </Button>
        </div>
      </PopoverCard>
    </div>
  );
}
