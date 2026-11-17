'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Chip } from '@/components/ui/spectrum-chip';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { addDaysIso, sheetDate } from '@/lib/receivables/dates';
import type { Partner } from '@/lib/receivables/model';
import type { ApproveEdit, ImportRowDto, ImportRowKind, PendingImportsDto } from '@/lib/receivables/v2-wire';
import { useImportActions } from '@/hooks/use-receivables-v2';
import { cn } from '@/lib/utils';
import { inr } from '../../format';
import { CELL } from './cell-utils';
import { DatePick } from './DatePick';

/**
 * The "Awaiting approval" panel at the top of the Sheet tab (docs/specs/receivables/V2.md). It
 * shows every pending row, from a Tally upload or a staff amount change, grouped Partner ▸ Client.
 *
 * Ticks: NEW, CHANGED and MATCHED rows start ticked (MATCHED: an invoice with no number that Tally
 * matched by client and amount; approving fills in the number); SAME rows are greyed and cannot be ticked; NO PARTNER
 * rows stay unticked until a partner is picked for their client. Credit days are the client's
 * (one box per client, which also moves the due dates of its new rows); the due date is per row.
 * "Approve N → Invoices" sends the ticked rows with their edits; rows the server refuses (a
 * received invoice, a client with no partner) stay in the panel and are named in a toast.
 */

const KIND: Record<ImportRowKind, { label: string; tone: 'ok' | 'warn' | 'idle' | 'bad' | 'prog' }> = {
  new: { label: 'NEW', tone: 'ok' },
  changed: { label: 'CHANGED', tone: 'warn' },
  same: { label: 'SAME', tone: 'idle' },
  no_partner: { label: 'NO PARTNER', tone: 'bad' },
  matched: { label: 'MATCHED', tone: 'prog' },
};

const REFUSED: Record<string, string> = {
  paid_locked: 'received or part-paid (reopen the payment first)',
  no_partner: 'no client partner picked',
  already_exists: 'the voucher number is already on the sheet',
  not_found: 'the invoice is gone',
  due_date: 'a due date is not valid',
  invoice_date: 'no invoice date',
};

const TH = 'whitespace-nowrap border-b border-line bg-surface-sunken px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[.04em] text-ink-muted';
const TD = 'border-t border-line-soft px-2 py-1.5 align-middle';

type ClientGroup = { key: string; clientId: string | null; name: string; rows: ImportRowDto[] };
type PartnerGroup = { key: string; name: string; clients: ClientGroup[]; total: number };

export function ApprovalPanel({ sheetId, pending, partners }: { sheetId: string; pending: PendingImportsDto; partners: Partner[] }) {
  const actions = useImportActions(sheetId);
  const rows = pending.rows;
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  /** Rows the person has ticked or unticked themselves; the defaults do not override those. */
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [due, setDue] = useState<Record<string, string>>({});
  const [days, setDays] = useState<Record<string, number>>({});
  const [partnerPick, setPartnerPick] = useState<Record<string, string>>({});

  const clientKeyOf = (r: ImportRowDto) => r.clientId ?? `name:${r.clientName}`;
  const partnerOf = (r: ImportRowDto) => partnerPick[clientKeyOf(r)] || r.partnerId || null;
  const creditOf = (r: ImportRowDto) => days[clientKeyOf(r)] ?? r.creditDays;
  const needsPartner = (r: ImportRowDto) => (r.kind === 'no_partner' || r.kind === 'new') && !partnerOf(r);

  // Default ticks for rows that arrive (new upload, a staff change); rows the person touched keep their state.
  const rowIds = rows.map((r) => r.id).join(',');
  useEffect(() => {
    setTicked((prev) => {
      const next = new Set<string>();
      for (const r of rows) {
        if (touched.has(r.id)) {
          if (prev.has(r.id)) next.add(r.id);
        } else if (r.kind === 'new' || r.kind === 'changed' || r.kind === 'matched') next.add(r.id);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the set of rows changes
  }, [rowIds]);

  const dueOf = (r: ImportRowDto): string | null => {
    if (due[r.id]) return due[r.id]!;
    if ((r.kind === 'new' || r.kind === 'no_partner') && r.invoiceDate && days[clientKeyOf(r)] !== undefined) return addDaysIso(r.invoiceDate, creditOf(r));
    return r.dueDate;
  };

  const partnerName = (id: string | null) => (id ? (partners.find((p) => p.id === id)?.name ?? 'A removed partner') : 'No client partner yet');

  const groups: PartnerGroup[] = useMemo(() => {
    const byPartner = new Map<string, PartnerGroup>();
    for (const r of rows) {
      const pid = partnerOf(r);
      const pkey = pid ?? 'none';
      let pg = byPartner.get(pkey);
      if (!pg) {
        pg = { key: pkey, name: partnerName(pid), clients: [], total: 0 };
        byPartner.set(pkey, pg);
      }
      const ckey = clientKeyOf(r);
      let cg = pg.clients.find((c) => c.key === ckey);
      if (!cg) {
        cg = { key: ckey, clientId: r.clientId, name: r.clientName, rows: [] };
        pg.clients.push(cg);
      }
      cg.rows.push(r);
      if (r.kind !== 'same') pg.total += r.amountInr;
    }
    // Partners by name, "No client partner yet" last; clients by name.
    return [...byPartner.values()]
      .sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.name.localeCompare(b.name)))
      .map((g) => ({ ...g, clients: g.clients.sort((a, b) => a.name.localeCompare(b.name)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- derived from rows and the partner picks
  }, [rows, partnerPick, partners]);

  const tick = (r: ImportRowDto, on: boolean) => {
    setTouched((t) => new Set(t).add(r.id));
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(r.id);
      else next.delete(r.id);
      return next;
    });
  };

  const tickable = (r: ImportRowDto) => r.kind !== 'same' && !needsPartner(r);
  const chosen = rows.filter((r) => ticked.has(r.id) && tickable(r));
  const busy = actions.approve.isPending || actions.reject.isPending || actions.discard.isPending;

  const approve = () => {
    const edits: ApproveEdit[] = chosen.map((r) => {
      const key = clientKeyOf(r);
      const e: ApproveEdit = { rowId: r.id };
      if (due[r.id]) e.dueDate = due[r.id];
      else if (days[key] !== undefined && (r.kind === 'new' || r.kind === 'no_partner') && r.invoiceDate) e.dueDate = addDaysIso(r.invoiceDate, days[key]!);
      if (days[key] !== undefined) e.creditDays = days[key];
      if (partnerPick[key]) e.partnerId = partnerPick[key];
      return e;
    });
    actions.approve.mutate(
      { rowIds: chosen.map((r) => r.id), edits },
      {
        onSuccess: (res) => {
          setDue({});
          setTouched(new Set());
          const refused = res.refused.map((x) => {
            const r = rows.find((y) => y.id === x.rowId);
            return `${r?.invoiceNo ?? r?.clientName ?? 'A row'}: ${REFUSED[x.code] ?? x.code}`;
          });
          if (res.approved) toastSuccess(`${res.approved} row${res.approved === 1 ? '' : 's'} approved`, refused.length ? `Not approved: ${refused.join('; ')}` : 'The invoices are on the sheet.');
          else toastError('Nothing approved', refused.join('; ') || undefined);
        },
        onError: (e) => toastError('Not approved', e instanceof Error ? e.message : undefined),
      },
    );
  };

  const reject = () =>
    actions.reject.mutate(
      chosen.map((r) => r.id),
      { onSuccess: (res) => toastSuccess(`${res.rejected} row${res.rejected === 1 ? '' : 's'} rejected`), onError: (e) => toastError('Not rejected', e instanceof Error ? e.message : undefined) },
    );

  const discard = () =>
    pending.batch &&
    actions.discard.mutate(pending.batch.id, {
      onSuccess: () => toastSuccess('Upload discarded', 'Nothing was added to the sheet.'),
      onError: (e) => toastError('Not discarded', e instanceof Error ? e.message : undefined),
    });

  const counts = rows.reduce<Record<ImportRowKind, number>>((acc, r) => ((acc[r.kind] += 1), acc), { new: 0, changed: 0, same: 0, no_partner: 0, matched: 0 });
  const meta = [
    counts.new ? `${counts.new} new` : '',
    counts.changed ? `${counts.changed} changed` : '',
    counts.matched ? `${counts.matched} matched by client and amount` : '',
    counts.no_partner ? `${counts.no_partner} with no partner` : '',
    counts.same ? `${counts.same} same` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DashSection
      title="Awaiting approval"
      meta={meta}
      right={
        <div className="flex flex-wrap items-center gap-2">
          {pending.batch ? (
            <Button size="sm" variant="quiet" disabled={busy} onClick={discard}>
              <Trash2 aria-hidden />
              Discard upload
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" disabled={busy || !chosen.length} onClick={reject}>
            <X aria-hidden />
            Reject
          </Button>
          <Button size="sm" disabled={busy || !chosen.length} onClick={approve}>
            <Check aria-hidden />
            {`Approve ${chosen.length} → Invoices`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {pending.batch ? (
          <p className="text-[12.5px] text-ink-muted">
            {`${pending.batch.fileName}`}
            {pending.batch.company ? ` · ${pending.batch.company}` : ''}
            {pending.batch.period ? ` · ${pending.batch.period}` : ''}
            {pending.batch.uploadedByName ? ` · uploaded by ${pending.batch.uploadedByName}` : ''}
          </p>
        ) : null}
        {groups.map((pg) => (
          <section key={pg.key} aria-label={pg.name} className="rounded-md border border-line bg-surface-raised">
            <header className="flex items-center justify-between gap-2 border-b border-line bg-surface-sunken px-3 py-2">
              <h3 className="text-[13px] font-semibold text-ink">{pg.name}</h3>
              <span className="font-mono text-[12px] text-ink-2">{`₹${inr(pg.total)}`}</span>
            </header>
            {pg.clients.map((cg) => {
              const first = cg.rows[0]!;
              const needs = cg.rows.some((r) => r.kind === 'no_partner' || (r.kind === 'new' && !r.partnerId));
              return (
                <div key={cg.key} className="overflow-x-auto">
                  <div className="flex flex-wrap items-center gap-3 px-3 pb-1 pt-2.5 text-[12.5px]">
                    <span className="font-semibold text-ink">{cg.name}</span>
                    <label className="inline-flex items-center gap-1.5 text-ink-muted">
                      Credit days
                      <input
                        type="number"
                        min={0}
                        max={365}
                        className={cn(CELL, 'w-16 rounded-md border border-line px-1.5 text-right')}
                        value={creditOf(first)}
                        aria-label={`Credit days of ${cg.name}`}
                        onChange={(e) => {
                          const n = Math.max(0, Math.min(365, Math.round(Number(e.target.value) || 0)));
                          setDays((d) => ({ ...d, [cg.key]: n }));
                        }}
                      />
                    </label>
                    {needs ? (
                      <label className="inline-flex items-center gap-1.5 text-ink-muted">
                        Client partner
                        <select
                          className={cn(CELL, 'w-48 cursor-pointer rounded-md border border-line px-1.5')}
                          aria-label={`Client partner of ${cg.name}`}
                          value={partnerPick[cg.key] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPartnerPick((p) => ({ ...p, [cg.key]: v }));
                            // Picking a partner ticks the client's rows that waited for one.
                            if (v) setTicked((prev) => new Set([...prev, ...cg.rows.filter((r) => r.kind !== 'same').map((r) => r.id)]));
                          }}
                        >
                          <option value="">Pick a partner…</option>
                          {partners
                            .filter((p) => p.active)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]" aria-label={`Rows of ${cg.name}`}>
                    <thead>
                      <tr>
                        <th className={cn(TH, 'w-9 px-0 text-center')}>
                          <span className="sr-only">Approve</span>
                        </th>
                        <th className={cn(TH, 'w-[110px]')}>Kind</th>
                        <th className={TH}>Invoice no.</th>
                        <th className={cn(TH, 'w-[104px]')}>Invoice date</th>
                        <th className={cn(TH, 'w-[150px]')}>Due date</th>
                        <th className={cn(TH, 'text-right')}>Amount ₹</th>
                        <th className={TH}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cg.rows.map((r) => {
                        const can = tickable(r);
                        const on = can && ticked.has(r.id);
                        const d = dueOf(r);
                        return (
                          <tr key={r.id} className={cn(r.kind === 'same' && 'text-ink-faint')}>
                            <td className={cn(TD, 'px-0 text-center')}>
                              <Checkbox className="mx-auto" aria-label={`Approve ${r.invoiceNo ?? r.clientName}`} checked={on} disabled={!can || busy} onCheckedChange={(v) => tick(r, v === true)} />
                            </td>
                            <td className={TD}>
                              <span className="inline-flex items-center gap-1">
                                <Chip raw tone={KIND[r.kind].tone}>
                                  {KIND[r.kind].label}
                                </Chip>
                                {r.source === 'staff' ? <span className="text-[11px] text-ink-muted">staff</span> : null}
                              </span>
                            </td>
                            <td className={cn(TD, 'font-mono text-[12px]')}>{r.invoiceNo ?? '—'}</td>
                            <td className={cn(TD, 'tabular-nums')}>{r.invoiceDate ? sheetDate(r.invoiceDate) : '—'}</td>
                            <td className={TD}>
                              {r.kind === 'same' ? (
                                <span className="tabular-nums">{d ? sheetDate(d) : '—'}</span>
                              ) : (
                                <DatePick variant="cell" label={`Due date of ${r.invoiceNo ?? r.clientName}`} value={d ?? ''} onChange={(v) => setDue((x) => ({ ...x, [r.id]: v }))} />
                              )}
                            </td>
                            <td className={cn(TD, 'whitespace-nowrap text-right font-mono text-[12px]')}>
                              {r.kind === 'changed' && r.oldAmountInr !== null ? (
                                <span>
                                  <span className="text-ink-muted line-through">{inr(r.oldAmountInr)}</span>
                                  {' → '}
                                  <b className="font-semibold text-ink">{inr(r.amountInr)}</b>
                                </span>
                              ) : (
                                inr(r.amountInr)
                              )}
                            </td>
                            <td className={cn(TD, 'text-[12.5px] text-ink-2')}>
                              {r.reason ??
                                (r.kind === 'changed'
                                  ? 'Tally shows a different amount'
                                  : r.kind === 'same'
                                    ? 'Already on the sheet'
                                    : r.kind === 'matched'
                                      ? 'Same client and amount as an invoice with no number; approve to fill in the Tally number'
                                      : '')}
                              {r.requestedByName && r.source === 'staff' ? <span className="block text-[11.5px] text-ink-muted">{`by ${r.requestedByName}`}</span> : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </section>
        ))}
        {pending.warnings?.length ? (
          <details className="text-[12.5px] text-ink-muted">
            <summary className="cursor-pointer">{`${pending.warnings.length} note${pending.warnings.length === 1 ? '' : 's'} from the file`}</summary>
            <ul className="mt-1 list-disc pl-5">
              {pending.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </DashSection>
  );
}
