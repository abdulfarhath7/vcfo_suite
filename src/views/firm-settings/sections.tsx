'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, Plus, Trash2, X } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  MAX_REMINDER_DAYS,
  reminderDaysLabel,
  WEEKDAYS,
  workingDaysLabel,
  type FirmHoliday,
  type FirmSettings,
  type FirmSettingsPatch,
} from '@/lib/firm-settings/firm-settings';
import type { FirmSettingsHistoryRow, useFirmSettings } from './use-firm-settings';

type Save = (patch: FirmSettingsPatch) => void;

/** Zones the firm is likely to work in; the stored value is kept even when it is not listed. */
const TIMEZONES = ['Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'UTC'];

function plainDate(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function plainWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function KeyValue({ rows }: { rows: Array<{ k: string; v: string | null }> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.k} className="min-w-0">
          <dt className="text-[12.5px] text-ink-muted">{r.k}</dt>
          <dd className="mt-0.5 whitespace-pre-line break-words text-[14px] text-ink">
            {r.v?.trim() ? r.v : <span className="text-ink-faint">Not set</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Firm name, contact details and timezone. Edit, then Done saves only what changed. */
export function FirmProfileSection({ settings, canEdit, save, saving }: { settings: FirmSettings; canEdit: boolean; save: Save; saving: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(settings);

  const start = () => {
    setDraft(settings);
    setEditing(true);
  };
  const done = (e?: FormEvent) => {
    e?.preventDefault();
    save({
      firmName: draft.firmName ?? '',
      supportEmail: draft.supportEmail ?? '',
      supportPhone: draft.supportPhone ?? '',
      address: draft.address ?? '',
      timezone: draft.timezone,
    });
    setEditing(false);
  };
  const zones = TIMEZONES.includes(settings.timezone) ? TIMEZONES : [settings.timezone, ...TIMEZONES];

  return (
    <DashSection
      title="Firm profile"
      meta={
        canEdit ? (
          editing ? (
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => done()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Done
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="outline" onClick={start}>
              Edit
            </Button>
          )
        ) : undefined
      }
    >
      {editing ? (
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={done}>
          <div>
            <Label htmlFor="fs-name" className="text-[12.5px] text-ink-muted">Firm name</Label>
            <Input id="fs-name" className="mt-1" value={draft.firmName ?? ''} onChange={(e) => setDraft({ ...draft, firmName: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="fs-email" className="text-[12.5px] text-ink-muted">Support email</Label>
            <Input id="fs-email" type="email" className="mt-1" value={draft.supportEmail ?? ''} onChange={(e) => setDraft({ ...draft, supportEmail: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="fs-phone" className="text-[12.5px] text-ink-muted">Phone</Label>
            <Input id="fs-phone" type="tel" className="mt-1" value={draft.supportPhone ?? ''} onChange={(e) => setDraft({ ...draft, supportPhone: e.target.value })} />
          </div>
          <div>
            <Label className="text-[12.5px] text-ink-muted">Timezone</Label>
            <Select value={draft.timezone} onValueChange={(v) => setDraft({ ...draft, timezone: v })}>
              <SelectTrigger className="mt-1" aria-label="Timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="fs-address" className="text-[12.5px] text-ink-muted">Address</Label>
            <Textarea id="fs-address" rows={3} className="mt-1" value={draft.address ?? ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          </div>
          <button type="submit" className="sr-only">
            Save
          </button>
        </form>
      ) : (
        <KeyValue
          rows={[
            { k: 'Firm name', v: settings.firmName },
            { k: 'Support email', v: settings.supportEmail },
            { k: 'Phone', v: settings.supportPhone },
            { k: 'Timezone', v: settings.timezone },
            { k: 'Address', v: settings.address },
          ]}
        />
      )}
    </DashSection>
  );
}

/** Working days (saved on each click) and the firm's holidays. */
export function WorkingCalendarSection({ settings, canEdit, save }: { settings: FirmSettings; canEdit: boolean; save: Save }) {
  const [date, setDate] = useState('');
  const [label, setLabel] = useState('');

  const toggleDay = (day: number) => {
    const on = settings.workingDays.includes(day);
    const next = on ? settings.workingDays.filter((d) => d !== day) : [...settings.workingDays, day];
    if (next.length === 0) return;
    save({ workingDays: next });
  };
  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!date || !label.trim()) return;
    save({ holidays: [...settings.holidays.filter((h) => h.date !== date), { date, label: label.trim() }] });
    setDate('');
    setLabel('');
  };
  const remove = (h: FirmHoliday) => save({ holidays: settings.holidays.filter((x) => x.date !== h.date) });

  const columns: EFilingColumn<FirmHoliday>[] = [
    { key: 'date', header: 'Date', width: '130px', render: (h) => <span className="tabular-nums">{plainDate(h.date)}</span> },
    { key: 'label', header: 'Holiday', render: (h) => <span className="font-medium text-ink">{h.label}</span> },
    ...(canEdit
      ? [
          {
            key: 'remove',
            header: '',
            width: '56px',
            align: 'right' as const,
            render: (h: FirmHoliday) => (
              <Button size="sm" variant="quiet" aria-label={`Remove ${h.label}`} onClick={() => remove(h)}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <DashSection title="Working calendar" meta={workingDaysLabel(settings.workingDays)} bodyClassName="px-2 pb-2 pt-3">
      <div className="flex flex-wrap gap-1.5 px-2" role="group" aria-label="Working days">
        {WEEKDAYS.map((d) => {
          const on = settings.workingDays.includes(d.day);
          return (
            <button
              key={d.day}
              type="button"
              aria-pressed={on}
              disabled={!canEdit}
              onClick={() => toggleDay(d.day)}
              className={cn(
                'h-8 min-w-12 rounded-md border-1.5 px-2.5 text-[13px] font-medium transition-colors disabled:cursor-default',
                on ? 'border-brand-line bg-brand-soft text-brand-text' : 'border-line bg-surface-raised text-ink-muted',
                canEdit && !on && 'hover:bg-surface-sunken',
              )}
            >
              {d.short}
            </button>
          );
        })}
      </div>
      {canEdit ? (
        <form className="mt-3 flex flex-wrap items-end gap-2 px-2" onSubmit={add}>
          <div>
            <Label htmlFor="fs-hol-date" className="text-[12.5px] text-ink-muted">Date</Label>
            <Input id="fs-hol-date" type="date" className="mt-1 w-40" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="min-w-0 flex-1">
            <Label htmlFor="fs-hol-label" className="text-[12.5px] text-ink-muted">Holiday</Label>
            <Input id="fs-hol-label" className="mt-1" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={!date || !label.trim()}>
            <Plus className="h-4 w-4" aria-hidden />
            Add holiday
          </Button>
        </form>
      ) : null}
      <div className="mt-2">
        <EFilingGrid caption="Holidays" columns={columns} rows={settings.holidays} rowKey={(h) => h.date} pageSize={12} minWidth={360} empty="No holidays listed" />
      </div>
    </DashSection>
  );
}

/** The default reminder leads, in days before a due date. */
export function ReminderSection({ settings, canEdit, save }: { settings: FirmSettings; canEdit: boolean; save: Save }) {
  const [value, setValue] = useState('');
  const days = [...settings.reminderDays].sort((a, b) => b - a);
  const parsed = Number(value);
  const valid = value !== '' && Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_REMINDER_DAYS && !days.includes(parsed);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || days.length >= 6) return;
    save({ reminderDays: [...days, parsed] });
    setValue('');
  };

  return (
    <DashSection title="Default reminders" meta={reminderDaysLabel(days)}>
      <ul className="flex flex-wrap gap-2" aria-label="Reminder days">
        {days.length === 0 ? <li className="text-[13px] text-ink-muted">No default reminders</li> : null}
        {days.map((d) => (
          <li key={d} className="inline-flex h-8 items-center gap-1 rounded-md border-1.5 border-line bg-surface-raised pl-2.5 pr-1 text-[13px] font-medium text-ink">
            {d === 0 ? 'Due date' : `${d} ${d === 1 ? 'day' : 'days'} before`}
            {canEdit ? (
              <button
                type="button"
                className="grid h-6 w-6 place-items-center rounded-sm text-ink-muted hover:bg-surface-sunken"
                aria-label={`Remove the ${d} day reminder`}
                onClick={() => save({ reminderDays: days.filter((x) => x !== d) })}
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit && days.length < 6 ? (
        <form className="mt-3 flex items-end gap-2" onSubmit={add}>
          <div>
            <Label htmlFor="fs-remind" className="text-[12.5px] text-ink-muted">Days before</Label>
            <Input id="fs-remind" type="number" min={0} max={MAX_REMINDER_DAYS} className="mt-1 w-28" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Button type="submit" variant="outline" disabled={!valid}>
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </Button>
        </form>
      ) : null}
    </DashSection>
  );
}

/** The firm logo: shows the stored one, uploads a new one, removes it. */
export function BrandingSection({
  settings,
  canEdit,
  logoSrc,
  uploadLogo,
  removeLogo,
}: {
  settings: FirmSettings;
  canEdit: boolean;
  logoSrc: string;
  uploadLogo: ReturnType<typeof useFirmSettings>['uploadLogo'];
  removeLogo: ReturnType<typeof useFirmSettings>['removeLogo'];
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = uploadLogo.isPending || removeLogo.isPending;

  return (
    <DashSection title="Branding" meta={settings.firmName ?? undefined}>
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-20 w-40 place-items-center overflow-hidden rounded-md border-1.5 border-line bg-surface-sunken">
          {settings.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a private, same-origin stream; next/image adds nothing here
            <img src={logoSrc} alt={`${settings.firmName ?? 'Firm'} logo`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-[12.5px] text-ink-muted">No logo</span>
          )}
        </span>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogo.mutate(file);
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>
              {uploadLogo.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="h-4 w-4" aria-hidden />}
              {settings.hasLogo ? 'Replace logo' : 'Upload logo'}
            </Button>
            {settings.hasLogo ? (
              <Button variant="ghost" onClick={() => removeLogo.mutate()} disabled={busy}>
                Remove
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </DashSection>
  );
}

/** The latest settings changes, from the audit trail. */
export function SettingsHistorySection({ rows }: { rows: FirmSettingsHistoryRow[] }) {
  return (
    <DashSection title="Settings history" meta={rows.length || undefined} bodyClassName="p-0">
      {rows.length === 0 ? (
        <div className="p-4">
          <EmptyState title="No changes yet" />
        </div>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex min-w-0 items-start gap-3 border-t border-line-soft px-4 py-3 first:border-t-0">
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] leading-snug text-ink">{r.summary}</span>
                <span className="block truncate text-[12.5px] text-ink-muted">
                  {r.who ?? 'Someone'} · {plainWhen(r.at)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashSection>
  );
}
