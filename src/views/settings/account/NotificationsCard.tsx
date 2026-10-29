'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toastError } from '@/lib/toast-errors';
import type {
  EmailOptional,
  NotificationPrefs,
  NotificationPrefsPatch,
  WhatsAppCategory,
} from '@/lib/client-portal/notification-prefs';
import { ProfileCard, SettingsRow } from './settings-layout';

/*
 * Profile › Notifications (G-25, prototype ProfileScreen "notify"): email and WhatsApp per
 * category, quiet hours and the weekly digest, on the same `notification_prefs` store as the
 * client Settings page. Email for documents, steps, deadlines and timeline is locked on, as for
 * clients. The WhatsApp job reads the categories and quiet hours before it sends.
 */

type Row = { label: string; email?: EmailOptional; whatsapp?: WhatsAppCategory; locked?: boolean };

const ROWS: Row[] = [
  { label: 'Documents requested or sent back', whatsapp: 'docs', locked: true },
  { label: 'Step accepted or needs changes', whatsapp: 'steps', locked: true },
  { label: 'Deadlines and reminders', whatsapp: 'deadlines', locked: true },
  { label: 'Timeline changes', whatsapp: 'timeline', locked: true },
  { label: 'Announcements', email: 'announcements', whatsapp: 'announcements' },
  { label: 'Official feed news', email: 'feed', whatsapp: 'feed' },
  { label: 'Weekly digest', email: 'weeklyDigest' },
];

const timeInput = 'h-9 w-[112px] font-mono text-[13px] tabular-nums';

export function NotificationsCard({ id, title, whatsappOn }: { id: string; title: string; whatsappOn: boolean }) {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ start: '', end: '' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/account/notification-prefs')
      .then(async (res) => {
        if (!res.ok) throw new Error('load_failed');
        const json = (await res.json()) as { prefs: NotificationPrefs };
        if (cancelled) return;
        setPrefs(json.prefs);
        setDraft({ start: json.prefs.quietStart, end: json.prefs.quietEnd });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: NotificationPrefsPatch) {
    if (!prefs) return;
    const before = prefs;
    // Show the change at once; put it back if the save fails.
    setPrefs({
      ...prefs,
      email: { ...prefs.email, ...(patch.email ?? {}) },
      whatsapp: { ...prefs.whatsapp, ...(patch.whatsapp ?? {}) },
      quietHours: patch.quietHours ?? prefs.quietHours,
      quietStart: patch.quietStart ?? prefs.quietStart,
      quietEnd: patch.quietEnd ?? prefs.quietEnd,
    });
    setSaving(true);
    try {
      const res = await fetch('/api/account/notification-prefs', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = (await res.json().catch(() => ({}))) as { prefs?: NotificationPrefs };
      if (!res.ok || !json.prefs) throw new Error('save_failed');
      setPrefs(json.prefs);
    } catch {
      setPrefs(before);
      setDraft({ start: before.quietStart, end: before.quietEnd });
      toastError('Not saved', 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  }

  function saveTime(which: 'start' | 'end') {
    if (!prefs) return;
    const value = which === 'start' ? draft.start : draft.end;
    const current = which === 'start' ? prefs.quietStart : prefs.quietEnd;
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value) || value === current) {
      setDraft({ start: prefs.quietStart, end: prefs.quietEnd });
      return;
    }
    void save(which === 'start' ? { quietStart: value } : { quietEnd: value });
  }

  return (
    <ProfileCard id={id} title={title} meta={saving ? 'Saving…' : undefined}>
      {!prefs ? (
        <SettingsRow label="Channels">
          {failed ? (
            <span className="text-ink-muted">Could not load</span>
          ) : (
            <span className="block h-4 w-48 animate-pulse rounded-mark bg-surface-sunken" aria-hidden />
          )}
        </SettingsRow>
      ) : (
        <>
          <div className="overflow-x-auto px-4 py-2.5 md:px-5">
            <table className="w-full min-w-[420px] text-[14px]">
              <caption className="sr-only">Email and WhatsApp per kind of update</caption>
              <thead>
                <tr className="text-left text-[12px] font-medium text-ink-muted">
                  <th scope="col" className="py-1.5 pr-3 font-medium">
                    Update
                  </th>
                  <th scope="col" className="w-[88px] py-1.5 text-center font-medium">
                    Email
                  </th>
                  <th scope="col" className="w-[88px] py-1.5 text-center font-medium">
                    WhatsApp
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.label} className="border-t border-line-soft">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-ink">
                      {r.label}
                    </th>
                    <td className="py-2 text-center">
                      {r.locked ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-ink-muted" title="Always on">
                          <Checkbox checked disabled aria-label={`${r.label} by email, always on`} />
                          <Lock className="h-3 w-3" aria-hidden />
                        </span>
                      ) : r.email ? (
                        <Checkbox
                          checked={prefs.email[r.email]}
                          onCheckedChange={(v) => void save({ email: { [r.email!]: v === true } })}
                          aria-label={`${r.label} by email`}
                        />
                      ) : null}
                    </td>
                    <td className="py-2 text-center">
                      {r.whatsapp ? (
                        <Checkbox
                          checked={whatsappOn && prefs.whatsapp[r.whatsapp]}
                          disabled={!whatsappOn}
                          onCheckedChange={(v) => void save({ whatsapp: { [r.whatsapp!]: v === true } })}
                          aria-label={`${r.label} on WhatsApp`}
                        />
                      ) : (
                        <span className="text-ink-faint" aria-hidden>
                          –
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!whatsappOn ? (
            <SettingsRow label="WhatsApp" hint="Add your number and tick the consent box under About you">
              <span className="text-ink-muted">Off</span>
            </SettingsRow>
          ) : null}
          <SettingsRow label="Quiet hours" hint="No WhatsApp messages in this window, India time">
            <span className="flex flex-wrap items-center gap-2">
              <Switch
                checked={prefs.quietHours}
                onCheckedChange={(v) => void save({ quietHours: v })}
                aria-label="Quiet hours"
              />
              <Input
                type="time"
                aria-label="Quiet hours start"
                value={draft.start}
                disabled={!prefs.quietHours}
                onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))}
                onBlur={() => saveTime('start')}
                className={timeInput}
              />
              <span className="text-ink-muted">to</span>
              <Input
                type="time"
                aria-label="Quiet hours end"
                value={draft.end}
                disabled={!prefs.quietHours}
                onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))}
                onBlur={() => saveTime('end')}
                className={timeInput}
              />
            </span>
          </SettingsRow>
        </>
      )}
    </ProfileCard>
  );
}
