'use client';

import { useState } from 'react';
import { Pencil, Plus, Send, Trash2, X } from 'lucide-react';
import { DangerConfirm } from '@/components/ui/danger-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { compactInr } from '@/lib/receivables/kpis';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { ClientDto, PeopleDto } from '@/lib/receivables/v2-wire';
import type { ManagerSheetDto, PartnerDto } from '@/lib/receivables/wire';
import { cn } from '@/lib/utils';
import { inr } from '../../format';
import { EditPartnerDialog, ManageClientsDialog } from './dialogs';
import { ROW_BTN, TD, TH, errorText, sendStatement, statementBlock, type Actions, type PeopleActions } from './shared';

/**
 * The Partners sub-tab: a master–detail split. The left list holds every client partner with the
 * count and short total of their open invoices, a "No partner" entry for clients nobody owns, and
 * a [+] that opens a small add form. The right side shows the picked partner: name, email, their
 * own email switches, Edit, the clients they own and "Manage clients".
 */

const NONE = '__none__';

type Stat = { clients: ClientDto[]; openCount: number; openAmount: number };

function statOf(clients: ClientDto[]): Stat {
  return { clients, openCount: clients.reduce((a, c) => a + c.openCount, 0), openAmount: clients.reduce((a, c) => a + c.openAmount, 0) };
}

export function PartnersPane({ data, people, actions, act }: { data: ManagerSheetDto; people: PeopleDto; actions: Actions; act: PeopleActions }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PartnerDto | null>(null);
  const [managing, setManaging] = useState<PartnerDto | null>(null);
  const [deleting, setDeleting] = useState<PartnerDto | null>(null);

  const stats = new Map(data.partners.map((p) => [p.id, statOf(people.clients.filter((c) => c.partnerId === p.id))]));
  const known = new Set(data.partners.map((p) => p.id));
  const orphans = statOf(people.clients.filter((c) => !c.partnerId || !known.has(c.partnerId)));
  // The pick falls back to the first partner, or to "No partner" when there are none.
  const key = picked === NONE || (picked && known.has(picked)) ? picked : (data.partners[0]?.id ?? NONE);
  const partner = key === NONE ? null : (data.partners.find((p) => p.id === key) ?? null);
  const shown = partner ? (stats.get(partner.id) ?? statOf([])) : orphans;

  const update = (id: string, patch: { active?: boolean; notifyNewInvoice?: boolean; notifyRollup?: boolean }) =>
    actions.updatePartner.mutate({ id, ...patch }, { onError: (e) => toastError('Not saved', errorText(e)) });

  return (
    <div className="grid overflow-hidden rounded-md border border-line bg-surface-raised md:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-line md:border-b-0 md:border-r" aria-label="Client partners">
        <div className="flex h-10 items-center justify-between border-b border-line bg-surface-sunken pl-4 pr-2">
          <span className="text-[11px] font-semibold uppercase tracking-[.04em] text-ink-muted">{`Partners · ${data.partners.filter((p) => p.active).length} active`}</span>
          <Button size="iconSm" variant="quiet" className="!h-7 !w-7" aria-label={adding ? 'Close the add partner form' : 'Add a client partner'} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
            {adding ? <X aria-hidden /> : <Plus aria-hidden />}
          </Button>
        </div>
        {adding ? <AddPartnerForm actions={actions} onDone={() => setAdding(false)} /> : null}
        <ul className="max-h-[420px] overflow-y-auto py-1">
          {data.partners.map((p) => (
            <PartnerItem key={p.id} label={p.name} stat={stats.get(p.id)} on={key === p.id} faint={!p.active} onPick={() => setPicked(p.id)} />
          ))}
          {orphans.clients.length || !data.partners.length ? <PartnerItem label="No partner" stat={orphans} on={key === NONE} faint onPick={() => setPicked(NONE)} /> : null}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-col" aria-label={partner ? `Partner ${partner.name}` : 'Clients with no partner'}>
        <div className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-2 text-[13px]">
          <span className="min-w-0 flex-1 truncate">
            <b className={cn('text-[14px] font-semibold', partner && !partner.active && 'text-ink-faint')}>{partner?.name ?? 'No partner'}</b>
            <span className="text-ink-muted">{partner ? ` · ${partner.email}` : ' · these clients get no partner emails'}</span>
          </span>
          {partner ? (
            <>
              <SwitchItem id={`rcv-pt-new-${partner.id}`} label="New/revised" checked={partner.notifyNewInvoice} onChange={(v) => update(partner.id, { notifyNewInvoice: v })} />
              <SwitchItem id={`rcv-pt-roll-${partner.id}`} label="Roll-up" checked={partner.notifyRollup} onChange={(v) => update(partner.id, { notifyRollup: v })} />
              <SwitchItem id={`rcv-pt-act-${partner.id}`} label="Active" checked={partner.active} onChange={(v) => update(partner.id, { active: v })} />
              <Button size="sm" variant="secondary" className={ROW_BTN} onClick={() => setEditing(partner)} aria-label={`Edit ${partner.name}`}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button size="sm" variant="secondary" className={cn(ROW_BTN, 'text-danger')} onClick={() => setDeleting(partner)} aria-label={`Delete ${partner.name}`}>
                <Trash2 aria-hidden />
                Delete
              </Button>
            </>
          ) : null}
        </div>
        <ClientTable clients={shown.clients} act={act} empty={partner ? `${partner.name} has no clients yet. Use Manage clients to pick some.` : 'Every client has a partner.'} />
        <div className="flex flex-wrap items-center gap-3 border-t border-line-soft px-3 py-1.5">
          {partner ? (
            <Button size="sm" variant="secondary" className={ROW_BTN} onClick={() => setManaging(partner)}>
              Manage clients
            </Button>
          ) : null}
          <span className="text-[11.5px] text-ink-muted">
            {partner ? 'A partner email goes only when the sheet switch at the top and the partner’s own switch are both on.' : 'Pick a partner for these clients in the Clients tab.'}
          </span>
        </div>
      </section>

      {deleting ? (
        <DangerConfirm
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Delete ${deleting.name}?`}
          body={`${deleting.name}'s clients and invoices stay, with no partner, until you give them another. This cannot be undone.`}
          word="DELETE"
          confirm="Delete partner"
          onConfirm={() =>
            act.deletePartner
              .mutateAsync(deleting.id)
              .then(() => (setDeleting(null), setPicked(null), toastSuccess(`${deleting.name} deleted`)))
              .catch((e) => toastError('Not deleted', errorText(e)))
          }
        />
      ) : null}
      {editing ? (
        <EditPartnerDialog
          partner={editing}
          busy={actions.updatePartner.isPending}
          onClose={() => setEditing(null)}
          onSave={(patch) => actions.updatePartner.mutate({ id: editing.id, ...patch }, { onSuccess: () => (setEditing(null), toastSuccess('Saved')), onError: (e) => toastError('Not saved', errorText(e)) })}
        />
      ) : null}
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
    </div>
  );
}

function PartnerItem({ label, stat, on, faint, onPick }: { label: string; stat: Stat | undefined; on: boolean; faint?: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-current={on ? 'true' : undefined}
        onClick={onPick}
        title={stat?.clients.map((c) => c.name).join(', ') || undefined}
        className={cn(
          'flex w-full flex-col items-start gap-0.5 border-l-[3px] px-4 py-2 text-left text-[13px] transition-colors hover:bg-surface-sunken',
          on ? 'border-brand bg-surface-sunken font-semibold text-ink' : 'border-transparent',
          !on && faint && 'text-ink-faint',
        )}
      >
        <span className="w-full min-w-0 truncate">{label}</span>
        <span className="whitespace-nowrap text-[12px] font-normal tabular-nums text-ink-muted">{stat?.openCount ? `${stat.openCount} open · ${compactInr(stat.openAmount)}` : 'nothing open'}</span>
      </button>
    </li>
  );
}

function SwitchItem({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <label htmlFor={id} className="cursor-pointer text-ink-2">
        {label}
      </label>
      <Switch size="sm" id={id} checked={checked} onCheckedChange={onChange} />
    </span>
  );
}

function AddPartnerForm({ actions, onDone }: { actions: Actions; onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  return (
    <form
      className="flex flex-col gap-1.5 border-b border-line bg-surface-sunken p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !email.trim()) return;
        actions.addPartner.mutate(
          { name: name.trim(), email: email.trim() },
          { onSuccess: () => (setName(''), setEmail(''), onDone(), toastSuccess('Client partner added')), onError: (err) => toastError('Not added', errorText(err)) },
        );
      }}
    >
      <Input className="h-8 text-[13px]" aria-label="Partner name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <Input className="h-8 text-[13px]" aria-label="Partner email" type="email" value={email} maxLength={200} onChange={(e) => setEmail(e.target.value)} placeholder="name@sbcllp.in" />
      <Button type="submit" size="sm" className={ROW_BTN} disabled={!name.trim() || !email.trim() || actions.addPartner.isPending}>
        <Plus aria-hidden />
        Add partner
      </Button>
    </form>
  );
}

function ClientTable({ clients, act, empty }: { clients: ClientDto[]; act: PeopleActions; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-0" aria-label="Clients of the picked partner">
        <thead>
          <tr>
            <th className={TH}>Client</th>
            <th className={cn(TH, 'text-right')}>Credit</th>
            <th className={TH}>Billing email</th>
            <th className={cn(TH, 'text-right')}>Open ₹</th>
            <th className={TH}>
              <span className="sr-only">Statement</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const block = statementBlock(c);
            return (
              <tr key={c.id}>
                <td className={cn(TD, 'max-w-[240px] truncate font-medium')} title={c.name}>
                  {c.name}
                </td>
                <td className={cn(TD, 'text-right tabular-nums')}>{`${c.creditDays}d`}</td>
                <td className={cn(TD, 'max-w-[220px] truncate')} title={c.billingEmail ?? undefined}>
                  {c.billingEmail ?? <span className="text-ink-faint">—</span>}
                </td>
                <td className={cn(TD, 'text-right font-mono text-[12px] tabular-nums')}>{c.openCount ? inr(c.openAmount) : '—'}</td>
                <td className={cn(TD, 'w-px whitespace-nowrap text-right')}>
                  <Button
                    size="sm"
                    variant="secondary"
                    className={ROW_BTN}
                    disabled={!!block || act.sendStatement.isPending}
                    title={block ?? 'Email the open invoices to the client from your Outlook'}
                    aria-label={`Send statement to ${c.name}`}
                    onClick={() => sendStatement(act, c)}
                  >
                    <Send aria-hidden />
                    Send
                  </Button>
                </td>
              </tr>
            );
          })}
          {!clients.length ? (
            <tr>
              <td colSpan={5} className={cn(TD, 'text-center text-ink-muted')}>
                {empty}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
