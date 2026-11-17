'use client';

import { useState } from 'react';
import { Mail, MessageCircle, Pencil, Plus, RotateCw, Send, Trash2, Users } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { FilterSelect } from '@/components/ui/native-select';
import { Chip } from '@/components/ui/spectrum-chip';
import { Switch } from '@/components/ui/switch';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { ClientDto, EmailKind, EmailLogDto, EmailSettingsDto, PeopleDto } from '@/lib/receivables/v2-wire';
import type { ManagerSheetDto, OutlookStatusDto, PartnerDto } from '@/lib/receivables/wire';
import type { useReceivablesActions } from '@/hooks/use-receivables';
import { usePeople, usePeopleActions, type ClientWrite } from '@/hooks/use-receivables-v2';
import { cn } from '@/lib/utils';
import { inr } from '../format';
import { OUTLOOK_CONNECT_HREF } from './ComposeSummary';

/**
 * The People tab (receivables v2, docs/specs/receivables/V2.md), which replaced the Partners tab.
 * Five cards:
 *  1. Integrations: the Outlook connection (the same status and connect link as the header) and
 *     WhatsApp (DoubleTick), with the person's own number and a test message.
 *  2. Client partners: typed-in names and addresses (no logins), their clients ("Manage clients"),
 *     the per-partner email switches, and the sheet's switches for the new/revised invoice emails
 *     and the roll-up.
 *  3. Leadership digest: the switch, weekday and hour, and the typed-in recipients.
 *  4. Clients: partner, credit days, billing email and CC, open amount, and "Send statement".
 *  5. Schedule & log: the next roll-up and digest, the last 50 emails, Retry on a failed one.
 */

type Actions = ReturnType<typeof useReceivablesActions>;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 6);
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'am' : 'pm'} IST`;
const KIND_LABEL: Record<EmailKind, string> = {
  new_invoice: 'New invoice',
  revised: 'Revised',
  rollup: 'Roll-up',
  digest: 'Digest',
  client_statement: 'Statement',
};
const ERROR_LABEL: Record<string, string> = {
  outlook_not_connected: 'Outlook not connected',
  outlook_reconnect: 'Outlook needs reconnecting',
  send_failed: 'Outlook did not send',
  no_sender: 'No sender (the sheet has no manager)',
};
const WA_LABEL: Record<string, { text: string; tone: 'ok' | 'bad' | 'idle' | 'warn' }> = {
  sent: { text: 'Sent', tone: 'ok' },
  failed: { text: 'Failed', tone: 'bad' },
  no_phone: { text: 'No phone', tone: 'warn' },
  disabled: { text: 'Off', tone: 'idle' },
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');
const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—';

const TH = 'whitespace-nowrap border-b border-line bg-surface-sunken px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[.04em] text-ink-muted';
const TD = 'border-t border-line-soft px-2 py-1.5 align-middle text-[13px]';

export function PeopleTab({ data, actions, outlook, settingsHref }: { data: ManagerSheetDto; actions: Actions; outlook: OutlookStatusDto | undefined; settingsHref: string }) {
  const sheetId = data.sheet.id;
  const people = usePeople(sheetId);
  const act = usePeopleActions(sheetId);
  if (people.isLoading) return <p className="py-10 text-center text-ink-muted">Loading people…</p>;
  if (people.error || !people.data) return <p className="py-10 text-center text-danger">{people.error?.message ?? 'Could not load the People tab.'}</p>;
  const p = people.data;
  const saveSettings = (patch: Partial<EmailSettingsDto>) => act.saveSettings.mutate(patch, { onError: (e) => toastError('Not saved', errorText(e)) });
  return (
    <div className="flex flex-col gap-4">
      <Integrations outlook={outlook} whatsapp={p.whatsapp} settingsHref={settingsHref} onTest={() => act.testWhatsApp.mutate(undefined, { onSuccess: (r) => toastSuccess('Test sent', `To ${r.to}. Check WhatsApp on that phone.`), onError: (e) => toastError('Not sent', errorText(e)) })} testing={act.testWhatsApp.isPending} />
      <Partners data={data} people={p} actions={actions} act={act} saveSettings={saveSettings} />
      <Digest people={p} act={act} saveSettings={saveSettings} />
      <Clients data={data} people={p} act={act} />
      <ScheduleLog people={p} act={act} />
    </div>
  );
}

/* ---- 1. Integrations ------------------------------------------------------------------------- */

function Integrations({ outlook, whatsapp, settingsHref, onTest, testing }: { outlook: OutlookStatusDto | undefined; whatsapp: PeopleDto['whatsapp']; settingsHref: string; onTest: () => void; testing: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <DashSection title="Outlook" headIcon={{ icon: Mail, tone: 'blue' }}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
          {outlook?.connected ? (
            <span className="flex flex-col gap-0.5">
              <Chip raw tone="ok">
                Connected
              </Chip>
              <span className="text-ink-2">{outlook.msEmail}</span>
            </span>
          ) : (
            <span className="text-ink-2">Not connected. Emails you approve, send or retry go from your own Outlook.</span>
          )}
          {!outlook?.connected && outlook?.configured ? (
            <Button size="sm" variant="strong" asChild>
              <a href={OUTLOOK_CONNECT_HREF}>Connect Outlook</a>
            </Button>
          ) : null}
        </div>
      </DashSection>
      <DashSection title="WhatsApp (DoubleTick)" headIcon={{ icon: MessageCircle, tone: 'green' }}>
        <div className="flex flex-col gap-2 text-[13px]">
          <div className="flex flex-wrap items-center gap-2">
            {whatsapp.configured ? (
              <Chip raw tone="ok">
                Configured
              </Chip>
            ) : (
              <Chip raw tone="warn" title={`Missing on the server: ${whatsapp.missing.join(', ')}`}>
                Not set up
              </Chip>
            )}
            <span className="text-ink-2">After every receivables email from your Outlook, WhatsApp tells you what went out.</span>
          </div>
          {!whatsapp.configured ? <p className="text-[12.5px] text-ink-muted">{`The server needs ${whatsapp.missing.join(' and ')}.`}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-ink-2">
              {'Your number: '}
              <b className="font-mono font-medium text-ink">{whatsapp.myPhone ?? 'not set'}</b>
              {' · '}
              <a href={settingsHref} className="font-medium text-brand-text hover:underline">
                {whatsapp.myPhone ? 'Change in Account settings' : 'Add it in Account settings'}
              </a>
            </span>
            <Button size="sm" variant="secondary" disabled={!whatsapp.configured || !whatsapp.myPhone || testing} onClick={onTest}>
              <Send aria-hidden />
              Send test message
            </Button>
          </div>
        </div>
      </DashSection>
    </div>
  );
}

/* ---- 2. Client partners ---------------------------------------------------------------------- */

type PeopleActions = ReturnType<typeof usePeopleActions>;

function Partners({ data, people, actions, act, saveSettings }: { data: ManagerSheetDto; people: PeopleDto; actions: Actions; act: PeopleActions; saveSettings: (p: Partial<EmailSettingsDto>) => void }) {
  const s = people.settings;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState<PartnerDto | null>(null);
  const [managing, setManaging] = useState<PartnerDto | null>(null);
  const update = (id: string, patch: { active?: boolean; notifyNewInvoice?: boolean; notifyRollup?: boolean }) =>
    actions.updatePartner.mutate({ id, ...patch }, { onError: (e) => toastError('Not saved', errorText(e)) });
  const add = () =>
    actions.addPartner.mutate(
      { name: name.trim(), email: email.trim() },
      { onSuccess: () => (setName(''), setEmail(''), toastSuccess('Client partner added')), onError: (e) => toastError('Not added', errorText(e)) },
    );
  return (
    <DashSection title="Client partners" meta={`${data.partners.filter((p) => p.active).length} active`} headIcon={{ icon: Users, tone: 'violet' }}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md bg-surface-sunken px-3 py-2 text-[13px]">
          <span className="inline-flex items-center gap-2">
            <Switch id="rcv-sw-new" checked={s.emailNewInvoiceEnabled} onCheckedChange={(v) => saveSettings({ emailNewInvoiceEnabled: v })} />
            <label htmlFor="rcv-sw-new">New invoice emails</label>
          </span>
          <span className="inline-flex items-center gap-2">
            <Switch id="rcv-sw-revised" checked={s.emailRevisedEnabled} onCheckedChange={(v) => saveSettings({ emailRevisedEnabled: v })} />
            <label htmlFor="rcv-sw-revised">Revised invoice emails</label>
          </span>
          <span className="inline-flex items-center gap-2">
            <Switch id="rcv-sw-rollup" checked={s.emailRollupEnabled} onCheckedChange={(v) => saveSettings({ emailRollupEnabled: v })} />
            <label htmlFor="rcv-sw-rollup">Roll-up every</label>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FilterSelect aria-label="Roll-up interval" value={String(s.rollupEveryDays)} onChange={(e) => saveSettings({ rollupEveryDays: Number(e.target.value) })} options={[1, 2, 3, 5, 7, 14].map((d) => ({ value: String(d), label: `${d} day${d === 1 ? '' : 's'}` }))} />
            at
            <FilterSelect aria-label="Roll-up hour" value={String(s.sendHourIst)} onChange={(e) => saveSettings({ sendHourIst: Number(e.target.value) })} options={HOURS.map((h) => ({ value: String(h), label: hourLabel(h) }))} />
          </span>
          <span className="text-[12px] text-ink-muted">An email goes only when the switch here and the partner&apos;s own switch are both on.</span>
        </div>

        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[820px] border-separate border-spacing-0" aria-label="Client partners">
            <thead>
              <tr>
                <th className={TH}>Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Clients</th>
                <th className={TH}>New / revised email</th>
                <th className={TH}>Roll-up</th>
                <th className={TH}>Active</th>
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.partners.map((partner) => {
                const clients = people.clients.filter((c) => c.partnerId === partner.id);
                return (
                  <tr key={partner.id} className={cn(!partner.active && 'text-ink-faint')}>
                    <td className={cn(TD, 'font-medium')}>{partner.name}</td>
                    <td className={TD}>{partner.email}</td>
                    <td className={TD}>
                      <span className="flex flex-wrap items-center gap-1">
                        <span title={clients.map((c) => c.name).join(', ')}>{clients.length ? `${clients.length} client${clients.length === 1 ? '' : 's'}` : 'None'}</span>
                        <Button size="sm" variant="quiet" onClick={() => setManaging(partner)}>
                          Manage clients
                        </Button>
                      </span>
                    </td>
                    <td className={TD}>
                      <Switch checked={partner.notifyNewInvoice} onCheckedChange={(v) => update(partner.id, { notifyNewInvoice: v })} aria-label={`New and revised invoice emails to ${partner.name}`} />
                    </td>
                    <td className={TD}>
                      <Switch checked={partner.notifyRollup} onCheckedChange={(v) => update(partner.id, { notifyRollup: v })} aria-label={`Roll-up to ${partner.name}`} />
                    </td>
                    <td className={TD}>
                      <Switch checked={partner.active} onCheckedChange={(v) => update(partner.id, { active: v })} aria-label={`${partner.name} active`} />
                    </td>
                    <td className={cn(TD, 'text-right')}>
                      <Button size="sm" variant="quiet" onClick={() => setEditing(partner)} aria-label={`Edit ${partner.name}`}>
                        <Pencil aria-hidden />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!data.partners.length ? (
                <tr>
                  <td colSpan={7} className={cn(TD, 'text-center text-ink-muted')}>
                    No client partners yet. Add one below.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && email.trim()) add();
          }}
        >
          <Field label="Name" className="min-w-[180px] flex-1">
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Phani Sai Teja" />
          </Field>
          <Field label="Email" className="min-w-[220px] flex-1">
            <Input type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} placeholder="name@sbcllp.in" />
          </Field>
          <Button type="submit" disabled={!name.trim() || !email.trim() || actions.addPartner.isPending}>
            <Plus aria-hidden />
            Add partner
          </Button>
        </form>
      </div>

      {editing ? <EditPartnerDialog partner={editing} busy={actions.updatePartner.isPending} onClose={() => setEditing(null)} onSave={(patch) => actions.updatePartner.mutate({ id: editing.id, ...patch }, { onSuccess: () => (setEditing(null), toastSuccess('Saved')), onError: (e) => toastError('Not saved', errorText(e)) })} /> : null}
      {managing ? (
        <ManageClientsDialog
          partner={managing}
          partners={data.partners}
          clients={people.clients}
          busy={act.setPartnerClients.isPending}
          onClose={() => setManaging(null)}
          onSave={(clientIds) =>
            act.setPartnerClients.mutate(
              { partnerId: managing.id, clientIds },
              { onSuccess: () => (setManaging(null), toastSuccess(`Clients of ${managing.name} saved`, 'Their invoices moved with them.')), onError: (e) => toastError('Not saved', errorText(e)) },
            )
          }
        />
      ) : null}
    </DashSection>
  );
}

function EditPartnerDialog({ partner, busy, onClose, onSave }: { partner: PartnerDto; busy: boolean; onClose: () => void; onSave: (patch: { name: string; email: string }) => void }) {
  const [name, setName] = useState(partner.name);
  const [email, setEmail] = useState(partner.email);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${partner.name}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !name.trim() || !email.trim()} onClick={() => onSave({ name: name.trim(), email: email.trim() })}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name" htmlFor="rcv-partner-name">
          <Input id="rcv-partner-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="rcv-partner-email">
          <Input id="rcv-partner-email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ManageClientsDialog({
  partner,
  partners,
  clients,
  busy,
  onClose,
  onSave,
}: {
  partner: PartnerDto;
  partners: PartnerDto[];
  clients: ClientDto[];
  busy: boolean;
  onClose: () => void;
  onSave: (clientIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(clients.filter((c) => c.partnerId === partner.id).map((c) => c.id)));
  const [q, setQ] = useState('');
  const shown = clients.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const otherName = (id: string | null) => (id && id !== partner.id ? partners.find((p) => p.id === id)?.name : null);
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Clients of ${partner.name}`}
      sub={`${picked.size} picked. A client picked here moves from any other partner, with its invoices.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={() => onSave([...picked])}>
            Save clients
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        <Input type="search" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
        <ul className="max-h-[360px] overflow-y-auto rounded-md border border-line">
          {shown.map((c) => (
            <li key={c.id} className="flex items-center gap-2 border-t border-line-soft px-2.5 py-1.5 text-[13px] first:border-t-0">
              <Checkbox
                id={`rcv-mc-${c.id}`}
                checked={picked.has(c.id)}
                onCheckedChange={(v) =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (v === true) next.add(c.id);
                    else next.delete(c.id);
                    return next;
                  })
                }
              />
              <label htmlFor={`rcv-mc-${c.id}`} className="flex-1 cursor-pointer">
                {c.name}
              </label>
              {otherName(c.partnerId) ? <span className="text-[12px] text-ink-muted">{`now ${otherName(c.partnerId)}`}</span> : null}
            </li>
          ))}
          {!shown.length ? <li className="px-2.5 py-3 text-center text-[13px] text-ink-muted">No clients match.</li> : null}
        </ul>
      </div>
    </Modal>
  );
}

/* ---- 3. Leadership digest -------------------------------------------------------------------- */

function Digest({ people, act, saveSettings }: { people: PeopleDto; act: PeopleActions; saveSettings: (p: Partial<EmailSettingsDto>) => void }) {
  const s = people.settings;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <DashSection title="Leadership digest" meta={`${people.digestRecipients.filter((r) => r.active).length} recipient(s)`}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-surface-sunken px-3 py-2 text-[13px]">
          <span className="inline-flex items-center gap-2">
            <Switch id="rcv-sw-digest" checked={s.digestEnabled} onCheckedChange={(v) => saveSettings({ digestEnabled: v })} />
            <label htmlFor="rcv-sw-digest">Weekly digest on</label>
          </span>
          <FilterSelect aria-label="Digest weekday" value={String(s.digestWeekday)} onChange={(e) => saveSettings({ digestWeekday: Number(e.target.value) })} options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))} />
          <FilterSelect aria-label="Digest hour" value={String(s.digestHourIst)} onChange={(e) => saveSettings({ digestHourIst: Number(e.target.value) })} options={HOURS.map((h) => ({ value: String(h), label: hourLabel(h) }))} />
          <span className="text-[12px] text-ink-muted">Partner ▸ client ▸ open invoices, with totals. Sent from the sheet manager&apos;s Outlook.</span>
        </div>
        {people.digestRecipients.length ? (
          <ul className="rounded-md border border-line">
            {people.digestRecipients.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-line-soft px-3 py-1.5 text-[13px] first:border-t-0">
                <Switch
                  checked={r.active}
                  onCheckedChange={(v) => act.updateRecipient.mutate({ id: r.id, active: v }, { onError: (e) => toastError('Not saved', errorText(e)) })}
                  aria-label={`Send the digest to ${r.name}`}
                />
                <span className={cn('font-medium', !r.active && 'text-ink-faint')}>{r.name}</span>
                <span className="text-ink-muted">{r.email}</span>
                <span className="flex-1" />
                <Button size="sm" variant="quiet" aria-label={`Remove ${r.name}`} onClick={() => act.removeRecipient.mutate(r.id, { onError: (e) => toastError('Not removed', errorText(e)) })}>
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-muted">No recipients yet.</p>
        )}
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || !email.trim()) return;
            act.addRecipient.mutate({ name: name.trim(), email: email.trim() }, { onSuccess: () => (setName(''), setEmail('')), onError: (err) => toastError('Not added', errorText(err)) });
          }}
        >
          <Field label="Name" className="min-w-[180px] flex-1">
            <Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" className="min-w-[220px] flex-1">
            <Input type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" disabled={!name.trim() || !email.trim() || act.addRecipient.isPending}>
            <Plus aria-hidden />
            Add recipient
          </Button>
        </form>
      </div>
    </DashSection>
  );
}

/* ---- 4. Clients ------------------------------------------------------------------------------ */

function Clients({ data, people, act }: { data: ManagerSheetDto; people: PeopleDto; act: PeopleActions }) {
  const [editing, setEditing] = useState<ClientDto | 'new' | null>(null);
  const [q, setQ] = useState('');
  const shown = people.clients.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const save = (patch: ClientWrite & { id: string }) => act.updateClient.mutate(patch, { onError: (e) => toastError('Not saved', errorText(e)) });
  const statement = (c: ClientDto) =>
    act.sendStatement.mutate(c.id, {
      onSuccess: () => toastSuccess(`Statement to ${c.billingEmail}`, 'Sending from your Outlook. The log below shows when it has gone.'),
      onError: (e) => toastError('Not sent', errorText(e)),
    });
  return (
    <DashSection
      title="Clients"
      meta={`${people.clients.length}`}
      right={
        <Button size="sm" variant="secondary" onClick={() => setEditing('new')}>
          <Plus aria-hidden />
          Add client
        </Button>
      }
    >
      <div className="flex flex-col gap-2">
        <Input type="search" className="max-w-[280px]" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[900px] border-separate border-spacing-0" aria-label="Clients">
            <thead>
              <tr>
                <th className={TH}>Client</th>
                <th className={TH}>Partner</th>
                <th className={cn(TH, 'w-[90px]')}>Credit days</th>
                <th className={TH}>Billing email</th>
                <th className={TH}>CC</th>
                <th className={cn(TH, 'text-right')}>Open ₹</th>
                <th className={TH}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td className={cn(TD, 'font-medium')}>{c.name}</td>
                  <td className={TD}>
                    <select
                      className="h-8 w-full min-w-[150px] cursor-pointer rounded-md border border-line bg-surface-raised px-1.5 text-[13px]"
                      aria-label={`Partner of ${c.name}`}
                      value={c.partnerId ?? ''}
                      onChange={(e) => save({ id: c.id, partnerId: e.target.value || null })}
                    >
                      <option value="">No partner</option>
                      {data.partners
                        .filter((p) => p.active || p.id === c.partnerId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td className={TD}>
                    <input
                      key={c.creditDays}
                      type="number"
                      min={0}
                      max={365}
                      defaultValue={c.creditDays}
                      aria-label={`Credit days of ${c.name}`}
                      className="h-8 w-[70px] rounded-md border border-line bg-surface-raised px-1.5 text-right text-[13px]"
                      onBlur={(e) => {
                        const n = Math.round(Number(e.target.value));
                        if (Number.isFinite(n) && n !== c.creditDays) save({ id: c.id, creditDays: n });
                      }}
                    />
                  </td>
                  <td className={cn(TD, 'max-w-[220px] truncate')} title={c.billingEmail ?? undefined}>
                    {c.billingEmail ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className={cn(TD, 'max-w-[200px] truncate text-ink-muted')} title={c.billingCc.join(', ')}>
                    {c.billingCc.length ? c.billingCc.join(', ') : '—'}
                  </td>
                  <td className={cn(TD, 'text-right font-mono text-[12px]')}>{c.openCount ? inr(c.openAmount) : '—'}</td>
                  <td className={cn(TD, 'whitespace-nowrap text-right')}>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!c.billingEmail || !c.openCount || act.sendStatement.isPending}
                      title={!c.billingEmail ? 'Add a billing email first' : !c.openCount ? 'No open invoices' : 'Email the open invoices to the client from your Outlook'}
                      onClick={() => statement(c)}
                    >
                      <Send aria-hidden />
                      Send statement
                    </Button>
                    <Button size="sm" variant="quiet" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                      <Pencil aria-hidden />
                    </Button>
                  </td>
                </tr>
              ))}
              {!shown.length ? (
                <tr>
                  <td colSpan={7} className={cn(TD, 'text-center text-ink-muted')}>
                    {people.clients.length ? 'No clients match.' : 'No clients yet. A Tally upload adds them, or add one here.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      {editing ? (
        <ClientDialog
          client={editing === 'new' ? null : editing}
          partners={data.partners}
          busy={act.addClient.isPending || act.updateClient.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            const done = { onSuccess: () => (setEditing(null), toastSuccess('Client saved')), onError: (e: unknown) => toastError('Not saved', errorText(e)) };
            if (editing === 'new') act.addClient.mutate({ ...input, name: input.name ?? '' }, done);
            else act.updateClient.mutate({ id: editing.id, ...input }, done);
          }}
        />
      ) : null}
    </DashSection>
  );
}

function ClientDialog({ client, partners, busy, onClose, onSave }: { client: ClientDto | null; partners: PartnerDto[]; busy: boolean; onClose: () => void; onSave: (input: ClientWrite) => void }) {
  const [name, setName] = useState(client?.name ?? '');
  const [partnerId, setPartnerId] = useState(client?.partnerId ?? '');
  const [creditDays, setCreditDays] = useState(String(client?.creditDays ?? 7));
  const [billingEmail, setBillingEmail] = useState(client?.billingEmail ?? '');
  const [cc, setCc] = useState((client?.billingCc ?? []).join(', '));
  const [gstin, setGstin] = useState(client?.gstin ?? '');
  const days = Math.round(Number(creditDays));
  const valid = name.trim() && Number.isFinite(days) && days >= 0 && days <= 365;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={client ? `Edit ${client.name}` : 'Add client'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !valid}
            onClick={() =>
              onSave({
                name: name.trim(),
                partnerId: partnerId || null,
                creditDays: days,
                billingEmail: billingEmail.trim() || null,
                billingCc: cc
                  .split(/[,;\s]+/)
                  .map((x) => x.trim())
                  .filter(Boolean),
                gstin: gstin.trim() || null,
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Client name" htmlFor="rcv-client-name" hint="As Tally names the buyer. Punctuation and case do not matter for matching.">
          <Input id="rcv-client-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Client partner" htmlFor="rcv-client-partner">
          <select id="rcv-client-partner" className="h-control w-full rounded-md border-1.5 border-line-strong bg-surface-raised px-2 text-[14px]" value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">No partner</option>
            {partners
              .filter((p) => p.active || p.id === partnerId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Credit days" htmlFor="rcv-client-days" hint="Due date = invoice date + credit days.">
          <Input id="rcv-client-days" type="number" min={0} max={365} value={creditDays} onChange={(e) => setCreditDays(e.target.value)} />
        </Field>
        <Field label="Billing email" htmlFor="rcv-client-email" hint="Where Send statement goes.">
          <Input id="rcv-client-email" type="email" value={billingEmail} maxLength={200} onChange={(e) => setBillingEmail(e.target.value)} />
        </Field>
        <Field label="CC" htmlFor="rcv-client-cc" hint="Separate addresses with commas.">
          <Input id="rcv-client-cc" value={cc} onChange={(e) => setCc(e.target.value)} />
        </Field>
        <Field label="GSTIN" htmlFor="rcv-client-gstin">
          <Input id="rcv-client-gstin" className="font-mono" value={gstin} maxLength={20} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---- 5. Schedule & log ----------------------------------------------------------------------- */

function ScheduleLog({ people, act }: { people: PeopleDto; act: PeopleActions }) {
  return (
    <DashSection title="Schedule & log" meta="Last 50 emails">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <span>
            <span className="text-ink-muted">Next roll-up: </span>
            <b className="font-medium">{people.nextRollupAt ? stamp(people.nextRollupAt) : 'Off'}</b>
          </span>
          <span>
            <span className="text-ink-muted">Next leadership digest: </span>
            <b className="font-medium">{people.nextDigestAt ? stamp(people.nextDigestAt) : 'Off'}</b>
          </span>
        </div>
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[860px] border-separate border-spacing-0" aria-label="Email log">
            <thead>
              <tr>
                <th className={TH}>When</th>
                <th className={TH}>Email</th>
                <th className={TH}>To</th>
                <th className={TH}>Subject</th>
                <th className={TH}>From</th>
                <th className={TH}>Status</th>
                <th className={TH}>WhatsApp</th>
                <th className={TH}>
                  <span className="sr-only">Retry</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.emailLog.map((l) => (
                <LogRow key={l.id} log={l} retrying={act.retryEmail.isPending} onRetry={() => act.retryEmail.mutate(l.id, { onSuccess: () => toastSuccess('Sending again', 'From your Outlook.'), onError: (e) => toastError('Not retried', errorText(e)) })} />
              ))}
              {!people.emailLog.length ? (
                <tr>
                  <td colSpan={8} className={cn(TD, 'text-center text-ink-muted')}>
                    No emails yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </DashSection>
  );
}

function LogRow({ log, onRetry, retrying }: { log: EmailLogDto; onRetry: () => void; retrying: boolean }) {
  const wa = log.whatsappStatus ? WA_LABEL[log.whatsappStatus] : null;
  const tone = log.status === 'sent' ? 'ok' : log.status === 'failed' ? 'bad' : log.status === 'sending' ? 'prog' : 'idle';
  return (
    <tr>
      <td className={cn(TD, 'whitespace-nowrap tabular-nums')}>{stamp(log.sentAt ?? log.createdAt)}</td>
      <td className={TD}>{KIND_LABEL[log.kind] ?? log.kind}</td>
      <td className={cn(TD, 'max-w-[200px] truncate')} title={[...log.to, ...log.cc].join(', ')}>
        {log.recipientName || log.to.join(', ')}
      </td>
      <td className={cn(TD, 'max-w-[260px] truncate')} title={log.subject}>
        {log.subject}
      </td>
      <td className={cn(TD, 'whitespace-nowrap')}>{log.senderName ?? '—'}</td>
      <td className={TD}>
        <span className="flex flex-col items-start gap-0.5">
          <Chip raw tone={tone}>
            {log.status === 'sent' ? 'Sent' : log.status === 'failed' ? 'Failed' : log.status === 'sending' ? 'Sending' : 'Skipped'}
          </Chip>
          {log.error ? <span className="text-[11.5px] text-ink-muted">{ERROR_LABEL[log.error] ?? log.error}</span> : null}
        </span>
      </td>
      <td className={TD}>{wa ? <Chip raw tone={wa.tone}>{wa.text}</Chip> : <span className="text-ink-faint">—</span>}</td>
      <td className={cn(TD, 'text-right')}>
        {log.status === 'failed' || log.status === 'skipped' ? (
          <Button size="sm" variant="secondary" disabled={retrying} onClick={onRetry}>
            <RotateCw aria-hidden />
            Retry
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
