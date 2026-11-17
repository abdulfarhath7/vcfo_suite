'use client';

import { Chip } from '@/components/ui/spectrum-chip';
import { toastError } from '@/lib/toast-errors';
import { daysLeft, monthShort, sheetDate } from '@/lib/receivables/dates';
import { fxChange } from '@/lib/receivables/fx';
import type { SheetInvoice } from '@/lib/receivables/model';
import type { ManagerInvoiceDto } from '@/lib/receivables/wire';
import { cn } from '@/lib/utils';
import { fcText, inr, parseInr, rateText, signedInr, statusText } from '../../format';
import { StatusChip } from '../../StatusChip';
import { PromiseChip } from '../InvoiceNotes';
import { CELL, fxInput, invoiceName } from './cell-utils';

/**
 * The sheet's cells (Phase 10), shared by the table and the phone cards: the in-place text and
 * amount editors, the compact two-line FX cell, the status stack and the next-reminder line.
 */

export function TextCell({ value, onCommit, label, mono, placeholder, list }: { value: string; onCommit: (v: string) => void; label: string; mono?: boolean; placeholder?: string; list?: string }) {
  return (
    <input
      key={value}
      className={cn(CELL, 'truncate', mono && 'font-mono text-[12px]')}
      defaultValue={value}
      aria-label={label}
      title={value || undefined}
      placeholder={placeholder}
      list={list}
      onBlur={(e) => e.target.value.trim() !== value && onCommit(e.target.value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

export function AmountCell({ value, onCommit, label }: { value: number; onCommit: (v: number) => void; label: string }) {
  return (
    <input
      key={value}
      className={cn(CELL, 'text-right font-mono text-[12px]')}
      inputMode="numeric"
      defaultValue={inr(value)}
      aria-label={label}
      onBlur={(e) => {
        const n = parseInr(e.target.value);
        if (!(n > 0)) {
          e.target.value = inr(value);
          toastError('Amount not changed', 'Enter an amount above zero.');
          return;
        }
        if (Math.round(n) !== Math.round(value)) onCommit(n);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}

/**
 * A foreign invoice's FX in two lines: the foreign amount at the booked rate, then the INR at
 * today's rate and the change against the booked INR. A click opens Edit FX.
 */
export function FxCell({ invoice, todayRate: usdRate, rates, onEdit }: { invoice: SheetInvoice; todayRate: number | null; rates?: Record<string, { rate: number } | null>; onEdit?: () => void }) {
  // Phase 10: each row converts at its own currency's rate (`rates`); `todayRate` is the USD rate.
  const cur = (invoice.currency ?? '').toUpperCase();
  const todayRate = rates && cur in rates ? (rates[cur]?.rate ?? null) : cur === 'USD' ? usdRate : null;
  const change = fxChange(fxInput(invoice), todayRate);
  const tone = change ? (change.changeInr < 0 ? 'text-danger' : change.changeInr > 0 ? 'text-positive' : 'text-ink-muted') : '';
  const body = (
    <>
      <span className="block truncate font-mono text-[12px] text-ink">
        {fcText(invoice) ?? `${invoice.currency} —`}
        <span className="text-ink-muted">{` @ ${invoice.fxRate ? invoice.fxRate.toFixed(2) : '—'}`}</span>
      </span>
      <span className="block truncate text-[11.5px] text-ink-muted">
        {change ? (
          <>
            {`Now ₹${inr(change.inrToday)} `}
            <span className={tone}>{signedInr(change.changeInr)}</span>
          </>
        ) : todayRate ? (
          'No booked rate'
        ) : (
          'No rate for today yet'
        )}
      </span>
    </>
  );
  const title = change ? `Booked at ${rateText(invoice.fxRate)}; at today's rate ₹${inr(change.inrToday)}, ${signedInr(change.changeInr)} (${change.changePct > 0 ? '+' : ''}${change.changePct.toFixed(2)}%)` : undefined;
  if (!onEdit) return <div title={title} className="min-w-0 leading-[1.35]">{body}</div>;
  return (
    <button
      type="button"
      onClick={onEdit}
      title={title}
      aria-label={`Edit currency of ${invoiceName(invoice)}`}
      className="block w-full min-w-0 rounded-md border border-transparent px-1.5 py-0.5 text-left leading-[1.35] hover:border-line focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25"
    >
      {body}
    </button>
  );
}

/** The status chip, plus Disputed, the promise and a part payment when there are any. */
/** v2: how many approved amount changes an invoice has had, as `r2`. */
export function RevisionBadge({ revision }: { revision: number }) {
  return (
    <span className="shrink-0 rounded-sm bg-warning-soft px-1 font-mono text-[10.5px] font-semibold text-warning-text" title={`Amount revised ${revision} time${revision === 1 ? '' : 's'}`}>
      {`r${revision}`}
    </span>
  );
}

/**
 * The status in one line (compact layout, 17 Nov 2026): a coloured dot and short text ("12d late",
 * "Due 5d", "Received"), then small marks for what else applies: ⚑ Fix in Tally, a promise date,
 * a dispute, a part payment. The full words are in the tooltip.
 */
export function StatusDot({ invoice, today }: { invoice: ManagerInvoiceDto; today: string }) {
  const s = statusText(invoice, today);
  const dl = daysLeft(invoice.dueDate, today);
  const short = invoice.status === 'received' ? 'Received' : dl < 0 ? `${-dl}d late` : dl === 0 ? 'Due today' : `Due ${dl}d`;
  const dot = s.tone === 'ok' ? 'bg-positive' : s.tone === 'bad' ? 'bg-danger' : s.tone === 'warn' ? 'bg-warning' : 'bg-ink-faint';
  const notes = [
    s.text,
    invoice.status === 'received' && invoice.paidOn ? `Paid ${sheetDate(invoice.paidOn)}` : '',
    invoice.tallyMismatch ? 'Fix in Tally: an approved amount change is not in Tally yet' : '',
    invoice.status === 'open' && invoice.disputed ? 'Disputed' : '',
    invoice.status === 'open' && invoice.promisedOn ? `Promised ${sheetDate(invoice.promisedOn)}` : '',
    invoice.status === 'open' && invoice.partPaid > 0 ? `₹${inr(invoice.partPaid)} part-paid` : '',
  ].filter(Boolean);
  return (
    <span className="flex min-w-0 items-center gap-1.5 whitespace-nowrap" title={notes.join(' · ')}>
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', dot)} />
      <span className={cn('truncate', s.tone === 'bad' ? 'text-danger' : 'text-ink-2')}>{short}</span>
      {invoice.tallyMismatch ? <span className="text-warning-text">⚑</span> : null}
      {invoice.status === 'open' && invoice.disputed ? <span className="text-[11px] font-semibold text-danger">D</span> : null}
      {invoice.status === 'open' && invoice.promisedOn ? <span className="text-[11px] text-ink-muted">{`P ${sheetDate(invoice.promisedOn).slice(0, 6)}`}</span> : null}
      {invoice.status === 'open' && invoice.partPaid > 0 ? <span className="text-[11px] text-ink-muted">part</span> : null}
      <span className="sr-only">{notes.join('. ')}</span>
    </span>
  );
}

export function StatusStack({ invoice, today }: { invoice: ManagerInvoiceDto; today: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <StatusChip invoice={invoice} today={today} />
      {invoice.tallyMismatch ? (
        <Chip raw tone="warn" title="An approved amount change is not in Tally yet. Fix it in Tally; the next upload with the same amount clears this.">
          ⚑ Fix in Tally
        </Chip>
      ) : null}
      {invoice.status === 'open' && invoice.disputed ? (
        <Chip raw tone="bad" title="Disputed: no reminders until it is resolved">
          Disputed
        </Chip>
      ) : null}
      {invoice.status === 'open' && invoice.promisedOn ? <PromiseChip invoice={invoice} today={today} /> : null}
      {invoice.status === 'open' && invoice.partPaid > 0 ? <span className="text-[11.5px] text-ink-muted">{`₹${inr(invoice.partPaid)} part-paid`}</span> : null}
      {invoice.status === 'received' && invoice.paidOn ? (
        <span className="text-[11.5px] text-ink-muted">
          {`Paid ${sheetDate(invoice.paidOn)}`}
          {invoice.paidVia === 'bank' ? ' · bank' : ''}
        </span>
      ) : null}
    </div>
  );
}

/** v2 (the reminders were removed): the invoice date, or a dash on rows made before invoice dates were kept. */
export function InvoiceDateCell({ invoice }: { invoice: SheetInvoice }) {
  return invoice.invoiceDate ? (
    <span className="px-1.5 tabular-nums text-ink-2">{sheetDate(invoice.invoiceDate)}</span>
  ) : (
    <span className="px-1.5 tabular-nums text-ink-faint" title="No invoice date yet; the invoice month is shown">
      {monthShort(invoice.invoiceMonth)}
    </span>
  );
}
