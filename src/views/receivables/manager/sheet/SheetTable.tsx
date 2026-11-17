'use client';

import { ActionMenu } from '@/components/ui/action-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { toastError } from '@/lib/toast-errors';
import { monthShort, sheetDate } from '@/lib/receivables/dates';
import { isForeign } from '@/lib/receivables/fx';
import type { Partner } from '@/lib/receivables/model';
import type { ManagerInvoiceDto, ManagerSheetDto } from '@/lib/receivables/wire';
import { cn } from '@/lib/utils';
import { fcText, inr } from '../../format';
import { NotesButton } from '../InvoiceNotes';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FxCell, InvoiceDateCell, RevisionBadge, StatusDot, TextCell } from './cells';
import { CELL, fxInput, invoiceName } from './cell-utils';
import { DatePick } from './DatePick';
import { createRowMenu } from './row-menu';
import type { RowGroup, SheetTabState } from './use-sheet-tab';

/**
 * The sheet table (Phase 10). Fixed columns that fit 1280 px without scrolling; the header sticks
 * to the top of the page there. Narrower (a tablet) the table scrolls sideways with the pick box
 * and the client column held at the left. Phones get the cards instead (SheetCards.tsx).
 */

const TH = 'sticky top-0 z-[2] whitespace-nowrap border-b border-line bg-surface-sunken px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[.04em] text-ink-muted';
/* Compact rows (the default) are about 28 px; Comfortable keeps the earlier 40 px. */
const TD_BASE = 'border-t border-line-soft px-2 align-middle';
const tdFor = (density: 'compact' | 'comfortable') => `${TD_BASE} ${density === 'compact' ? 'py-0' : 'py-1.5'}`;
/* The pick box and the client column stay put while a narrow screen scrolls sideways. */
const STICK_PICK = 'max-xl:sticky max-xl:left-0 max-xl:z-[1] max-xl:bg-surface-raised';
const STICK_CLIENT = 'max-xl:sticky max-xl:left-9 max-xl:z-[1] max-xl:bg-surface-raised max-xl:shadow-[1px_0_0_var(--line)]';

/** Phase 10: the FX column head names today's rate of each foreign currency on open rows. */
function fxHeader(data: ManagerSheetDto): string {
  const codes = [...new Set(data.invoices.filter((i) => i.status === 'open' && isForeign(fxInput(i))).map((i) => i.currency.toUpperCase()))];
  const parts = codes.map((c) => {
    const r = data.fxRates?.[c] ?? (c === 'USD' ? data.usdRate : null);
    return `${c} ${r ? r.rate.toFixed(2) : '—'}`;
  });
  return parts.length ? `FX · ${parts.join(' · ')}` : 'FX';
}

export function SheetTable({
  s,
  data,
  groups,
  today,
  todayRate,
  monthTitle,
  readOnly,
  label,
}: {
  s: SheetTabState;
  data: ManagerSheetDto;
  groups: RowGroup[];
  today: string;
  todayRate: number | null;
  /** The block title of a group (the month blocks); a section with one group passes its own. */
  monthTitle: (g: RowGroup) => string;
  /** Received rows: no in-place editing. */
  readOnly?: boolean;
  label: string;
}) {
  const fx = s.hasForeign;
  const cols = fx ? 12 : 11;
  const all = groups.flatMap((g) => g.rows);
  const allPicked = all.length > 0 && all.every((r) => s.picked.has(r.id));
  const somePicked = !allPicked && all.some((r) => s.picked.has(r.id));
  const partners = data.partners;
  const TD = tdFor(s.density);

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface-raised xl:overflow-visible">
      <table className={cn('w-full table-fixed border-separate border-spacing-0', s.density === 'compact' ? 'text-[12.5px]' : 'text-[13px]', fx ? 'min-w-[1360px]' : 'min-w-[1180px]')} aria-label={label}>
        <colgroup>
          <col className="w-9" />
          <col />
          <col className="w-[104px]" />
          <col className="w-[112px]" />
          <col className="w-[148px]" />
          <col className="w-[104px]" />
          <col className="w-[118px]" />
          <col className="w-[104px]" />
          <col className="w-[118px]" />
          {fx ? <col className="w-[184px]" /> : null}
          <col className="w-[132px]" />
          <col className="w-[104px]" />
          <col className="w-[80px]" />
        </colgroup>
        <thead>
          <tr>
            <th className={cn(TH, 'rounded-tl-[4px] px-0 text-center', STICK_PICK, 'max-xl:z-[3]')}>
              <Checkbox
                className="mx-auto"
                aria-label={allPicked ? `Clear the picked ${label.toLowerCase()}` : `Pick every row of ${label.toLowerCase()}`}
                checked={allPicked ? true : somePicked ? 'indeterminate' : false}
                onCheckedChange={(on) => s.toggleMany(all.map((r) => r.id), on === true)}
                disabled={!all.length}
              />
            </th>
            <th className={cn(TH, STICK_CLIENT, 'max-xl:z-[3]')}>Client</th>
            <th className={TH}>Invoice no.</th>
            <th className={TH}>Invoice date</th>
            <th className={TH}>Partner</th>
            <th className={TH}>Due date</th>
            <th className={cn(TH, 'text-right')}>Amount ₹</th>
            <th className={TH}>Received on</th>
            <th className={cn(TH, 'text-right')}>Received ₹</th>
            {fx ? <th className={TH}>{fxHeader(data)}</th> : null}
            <th className={TH}>Status</th>
            <th className={cn(TH, 'rounded-tr-[4px]')}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        {groups.map((g) => {
          const isFolded = s.folded.has(`${label}:${g.key}`);
          const subtotal = g.rows.reduce((a, r) => a + (r.status === 'received' ? (r.paidAmount ?? r.amountInr) : r.amountInr), 0);
          return (
            <tbody key={g.key}>
              <tr>
                <td colSpan={cols} className="border-t border-line bg-surface-sunken/60 p-0">
                  {/* The month header folds its rows; its subtotal replaces the old total row. */}
                  <button
                    type="button"
                    aria-expanded={!isFolded}
                    onClick={() => s.toggleFold(`${label}:${g.key}`)}
                    className="flex w-full items-center gap-2 px-2 py-1 text-left text-[12px] hover:bg-hover max-xl:sticky max-xl:left-0"
                  >
                    <ChevronDown className={cn('size-3.5 text-ink-muted transition-transform', isFolded && '-rotate-90')} aria-hidden />
                    <span className="font-semibold uppercase tracking-[.04em] text-ink">{monthTitle(g)}</span>
                    <span className="text-ink-muted">{`· ${g.rows.length} invoice${g.rows.length === 1 ? '' : 's'}`}</span>
                    <span className="ml-auto font-mono text-[12px] font-medium text-ink">{`₹${inr(subtotal)}`}</span>
                  </button>
                </td>
              </tr>
              {isFolded
                ? null
                : g.rows.map((inv) => (
                    <Row key={inv.id} inv={inv} s={s} data={data} partners={partners} today={today} todayRate={todayRate} fx={fx} readOnly={readOnly || inv.status !== 'open'} TD={TD} />
                  ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function Row({
  inv,
  s,
  data,
  partners,
  today,
  todayRate,
  fx,
  readOnly,
  TD,
}: {
  inv: ManagerInvoiceDto;
  s: SheetTabState;
  data: ManagerSheetDto;
  partners: Partner[];
  today: string;
  todayRate: number | null;
  fx: boolean;
  readOnly: boolean;
  TD: string;
}) {
  const foreign = isForeign(fxInput(inv));
  // A received invoice still takes a new client name, invoice number and partner (owner,
  // 17 Nov 2026); its amounts and dates stay as received.
  const editLabels = inv.status !== 'open' || !readOnly;
  const name = invoiceName(inv);
  const picked = s.picked.has(inv.id);
  const partnerName = (inv.partnerId && partners.find((p) => p.id === inv.partnerId)?.name) || '';
  const choices = partners.filter((p) => p.active || p.id === inv.partnerId);
  const bg = picked ? 'bg-brand-soft/50' : inv.status === 'received' ? 'bg-positive-soft/30' : 'bg-surface-raised';
  return (
    <tr className={cn('group', bg)} data-invoice={inv.id}>
      <td className={cn(TD, 'px-0 text-center', STICK_PICK, picked && 'max-xl:bg-brand-soft')}>
        <Checkbox className="mx-auto" aria-label={`Pick ${name}`} checked={picked} onCheckedChange={() => s.toggle(inv.id)} />
      </td>
      <td className={cn(TD, STICK_CLIENT, picked && 'max-xl:bg-brand-soft')}>
        {!editLabels ? (
          <span className="block truncate px-1.5" title={inv.clientName}>
            {inv.clientName}
          </span>
        ) : (
          <TextCell value={inv.clientName} label={`Client of ${name}`} list="rcv-sheet-clients" onCommit={(v) => (v ? s.edit(inv, { clientName: v }) : toastError('Not saved', 'The client name cannot be empty.'))} />
        )}
      </td>
      <td className={TD}>
        <span className="flex min-w-0 items-center gap-1">
          {!editLabels ? (
            <span className="block min-w-0 truncate px-1.5 font-mono text-[12px]">{inv.invoiceNo ?? '—'}</span>
          ) : (
            <TextCell value={inv.invoiceNo ?? ''} label={`Invoice number of ${inv.clientName}`} mono placeholder="optional" onCommit={(v) => s.edit(inv, { invoiceNo: v || null })} />
          )}
          {inv.revision ? <RevisionBadge revision={inv.revision} /> : null}
        </span>
      </td>
      <td className={TD}>
        {/* The invoice date; rows loaded from the weekly workbook have none, so their month shows until it is filled in. */}
        {foreign ? (
          <InvoiceDateCell invoice={inv} />
        ) : (
          <DatePick variant="cell" label={`Invoice date of ${name}`} value={inv.invoiceDate ?? ''} placeholder={monthShort(inv.invoiceMonth)} onChange={(v) => v && v !== inv.invoiceDate && s.edit(inv, { invoiceDate: v })} />
        )}
      </td>
      <td className={TD}>
        {!editLabels ? (
          <span className="block truncate px-1.5">{partnerName || '—'}</span>
        ) : (
          <select className={cn(CELL, 'cursor-pointer truncate pr-1')} aria-label={`Client partner of ${name}`} value={inv.partnerId ?? ''} onChange={(e) => s.edit(inv, { partnerId: e.target.value || null })}>
            <option value="">No partner</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className={TD}>
        {readOnly ? (
          <span className="block px-1.5 tabular-nums">{sheetDate(inv.dueDate)}</span>
        ) : (
          <DatePick variant="cell" label={`Due date of ${name}`} value={inv.dueDate} onChange={(v) => v !== inv.dueDate && s.edit(inv, { dueDate: v })} />
        )}
      </td>
      <td className={TD}>
        {inv.status === 'received' ? (
          // The invoiced amount: the open balance at receipt plus earlier part payments.
          <div className="px-1.5 text-right font-mono text-[12px]">{inr(inv.amountInr + inv.partPaid)}</div>
        ) : (
          // v2: an INR amount changes only through "Change amount" and the approval panel.
          <div className="px-1.5 text-right font-mono text-[12px]" title={foreign ? 'Booked INR; change it with the FX cell' : readOnly ? undefined : 'Change it with Change amount in the row menu'}>
            {inr(inv.amountInr)}
          </div>
        )}
      </td>
      {/* What was received and when, as entered at Mark received (part payments count while open). */}
      <td className={cn(TD, 'whitespace-nowrap tabular-nums')}>
        {inv.paidOn ? (
          <span className="px-1.5">{sheetDate(inv.paidOn)}</span>
        ) : inv.status === 'open' ? (
          // One click to Mark received: the dialog asks for the date received and the amount.
          <Button size="sm" variant="secondary" className="!h-6 !px-2 !text-[12px] [&_svg]:!size-3.5" aria-label={`Mark ${name} received`} onClick={() => s.runRow('mark', inv)}>
            <CheckCircle2 aria-hidden />
            Received
          </Button>
        ) : (
          <span className="px-1.5 text-ink-faint">—</span>
        )}
      </td>
      <td className={TD}>
        {inv.status === 'received' ? (
          <div className="px-1.5 text-right font-mono text-[12px] text-positive">{inr((inv.paidAmount ?? inv.amountInr) + inv.partPaid)}</div>
        ) : inv.partPaid > 0 ? (
          <div className="px-1.5 text-right font-mono text-[12px] text-ink-2" title="Part payments so far">{inr(inv.partPaid)}</div>
        ) : (
          <div className="px-1.5 text-right text-ink-faint">—</div>
        )}
      </td>
      {fx ? (
        <td className={TD}>
          {foreign ? (
            inv.status === 'received' ? (
              <span className="block truncate px-1.5 font-mono text-[12px]">{fcText(inv, inv.receivedFc ?? inv.fcAmount)}</span>
            ) : (
              <FxCell invoice={inv} todayRate={todayRate} rates={data.fxRates} onEdit={readOnly ? undefined : () => s.runRow('fx', inv)} />
            )
          ) : null}
        </td>
      ) : null}
      <td className={TD}>
        <StatusDot invoice={inv} today={today} />
      </td>
      <td className={cn(TD, 'whitespace-nowrap pr-1.5 text-right')}>
        <span className="inline-flex items-center justify-end gap-0.5">
          {inv.noteCount ? <NotesButton invoice={inv} onOpen={() => s.runRow('notes', inv)} /> : null}
          <ActionMenu label={`More actions for ${name}`} items={createRowMenu(inv, today, s.runRow)} />
        </span>
      </td>
    </tr>
  );
}
