'use client';

import { useState } from 'react';
import { Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DangerConfirm } from '@/components/ui/danger-confirm';
import { Input } from '@/components/ui/input';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { ClientDto, PeopleDto } from '@/lib/receivables/v2-wire';
import type { ManagerSheetDto } from '@/lib/receivables/wire';
import type { ClientWrite } from '@/hooks/use-receivables-v2';
import { cn } from '@/lib/utils';
import { inr } from '../../format';
import { ClientDialog } from './dialogs';
import { ROW_BTN, ROW_INPUT, TD, TH, errorText, sendStatement, statementBlock, type PeopleActions } from './shared';

/**
 * The Clients sub-tab: one dense table of every client with its partner and credit days edited in
 * place, the billing email and CC, the open amount, "Send statement" and the edit dialog.
 */
export function ClientsPane({ data, people, act }: { data: ManagerSheetDto; people: PeopleDto; act: PeopleActions }) {
  const [editing, setEditing] = useState<ClientDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ClientDto | null>(null);
  const [q, setQ] = useState('');
  const shown = people.clients.filter((c) => !q.trim() || c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const save = (patch: ClientWrite & { id: string }) => act.updateClient.mutate(patch, { onError: (e) => toastError('Not saved', errorText(e)) });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="search" className="h-8 max-w-[280px] text-[13px]" placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
        <span className="text-[12px] text-ink-muted">{`${shown.length} of ${people.clients.length}`}</span>
        <span className="flex-1" />
        <Button size="sm" variant="secondary" className={ROW_BTN} onClick={() => setEditing('new')}>
          <Plus aria-hidden />
          Add client
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-line bg-surface-raised">
        <table className="w-full min-w-[860px] border-separate border-spacing-0" aria-label="Clients">
          <thead>
            <tr>
              <th className={TH}>Client</th>
              <th className={TH}>Partner</th>
              <th className={cn(TH, 'w-[70px] text-right')}>Credit</th>
              <th className={TH}>Billing email</th>
              <th className={TH}>CC</th>
              <th className={cn(TH, 'text-right')}>Open ₹</th>
              <th className={TH}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const block = statementBlock(c);
              return (
                <tr key={c.id}>
                  <td className={cn(TD, 'max-w-[220px] truncate font-medium')} title={c.name}>
                    {c.name}
                  </td>
                  <td className={TD}>
                    <select className={cn(ROW_INPUT, 'w-full min-w-[140px] cursor-pointer')} aria-label={`Partner of ${c.name}`} value={c.partnerId ?? ''} onChange={(e) => save({ id: c.id, partnerId: e.target.value || null })}>
                      <option value="">No partner</option>
                      {data.partners
                        .filter((p) => p.active || p.id === c.partnerId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    {c.coPartnerIds.length ? (
                      <button type="button" className="mt-0.5 block max-w-[220px] truncate text-left text-[11.5px] text-ink-muted hover:text-ink" title="Second partners. Click to change." onClick={() => setEditing(c)}>
                        {`+ ${c.coPartnerIds.map((id) => data.partners.find((p) => p.id === id)?.name ?? '?').join(', ')}`}
                      </button>
                    ) : null}
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <input
                      key={c.creditDays}
                      type="number"
                      min={0}
                      max={365}
                      defaultValue={c.creditDays}
                      aria-label={`Credit days of ${c.name}`}
                      className={cn(ROW_INPUT, 'w-[56px] text-right tabular-nums')}
                      onBlur={(e) => {
                        const n = Math.round(Number(e.target.value));
                        if (Number.isFinite(n) && n !== c.creditDays) save({ id: c.id, creditDays: n });
                      }}
                    />
                  </td>
                  <td className={cn(TD, 'max-w-[200px] truncate')} title={c.billingEmail ?? undefined}>
                    {c.billingEmail ?? <span className="text-ink-faint">—</span>}
                  </td>
                  <td className={cn(TD, 'max-w-[180px] truncate text-ink-muted')} title={c.billingCc.join(', ')}>
                    {c.billingCc.length ? c.billingCc.join(', ') : '—'}
                  </td>
                  <td className={cn(TD, 'text-right font-mono text-[12px] tabular-nums')}>{c.openCount ? inr(c.openAmount) : '—'}</td>
                  <td className={cn(TD, 'w-px whitespace-nowrap text-right')}>
                    <span className="inline-flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className={ROW_BTN}
                        disabled={!!block || act.sendStatement.isPending}
                        title={block ?? 'Email the open invoices to the client from your Outlook'}
                        onClick={() => sendStatement(act, c)}
                      >
                        <Send aria-hidden />
                        Send statement
                      </Button>
                      <Button size="iconSm" variant="quiet" className="!h-7 !w-7" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)}>
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        size="iconSm"
                        variant="quiet"
                        className="!h-7 !w-7 text-danger"
                        aria-label={`Delete ${c.name}`}
                        title={c.openCount ? 'Delete or move its invoices first' : 'Delete this client'}
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </span>
                  </td>
                </tr>
              );
            })}
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
      {deleting ? (
        <DangerConfirm
          open
          onOpenChange={(o) => !o && setDeleting(null)}
          title={`Delete ${deleting.name}?`}
          body="Only a client with no invoices can be deleted. This cannot be undone."
          word="DELETE"
          confirm="Delete client"
          onConfirm={() =>
            act.deleteClient
              .mutateAsync(deleting.id)
              .then(() => (setDeleting(null), toastSuccess(`${deleting.name} deleted`)))
              .catch((e) => toastError('Not deleted', errorText(e)))
          }
        />
      ) : null}
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
    </div>
  );
}
