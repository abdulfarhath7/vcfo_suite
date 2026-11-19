'use client';

import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { sheetDate } from '@/lib/receivables/dates';
import type { SnapshotRow } from '@/lib/receivables/model';
import type { SentHit } from '@/lib/receivables/sent-receipts';
import { cn } from '@/lib/utils';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/**
 * The invoices in one email of the Send email pop-up (owner, 18 Nov 2026). ✕ takes an invoice out of
 * the email; with `everyEmail` it leaves every email of the send (owner, 19 Nov 2026). Nothing on the
 * sheet changes. A received invoice already sent to this person is
 * flagged, and the email cannot go until the person removes it: it is never removed for them.
 */
type Row = Pick<SnapshotRow, 'id' | 'clientName' | 'invoiceNo' | 'amountInr' | 'status' | 'paidOn'>;

export function InvoicesInEmail({ rows, removed, hits, onToggle, everyEmail = false }: { rows: Row[]; removed: string[]; hits: SentHit[]; onToggle: (id: string) => void; everyEmail?: boolean }) {
  const kept = rows.filter((r) => !removed.includes(r.id));
  const out = rows.filter((r) => removed.includes(r.id));
  const hitOf = (id: string) => hits.find((h) => h.invoiceId === id);
  return (
    <section aria-label="Invoices in this email" className="rounded-md border border-line">
      <div className="flex items-center justify-between border-b border-line-soft bg-surface-sunken px-2.5 py-1 text-[12px]">
        <b className="font-medium text-ink-2">{`Invoices in this email (${kept.length})`}</b>
        <span className="text-ink-muted">{everyEmail ? '✕ removes it from every email in this send. The sheet does not change.' : '✕ removes it from this email only. The text below is rebuilt.'}</span>
      </div>
      <ul className="max-h-[22vh] overflow-y-auto">
        {kept.map((r) => {
          const hit = hitOf(r.id);
          return (
            <li key={r.id} className={cn('flex items-center gap-2 border-t border-line-soft px-2.5 py-1 text-[12.5px] first:border-t-0', hit && 'bg-warning-soft')}>
              {hit ? <AlertTriangle className="size-3.5 flex-none text-warning" aria-hidden /> : null}
              <span className="min-w-0 flex-1 truncate">
                <b className="font-medium text-ink">{r.clientName}</b>
                <span className="text-ink-muted">{` · ${r.invoiceNo ?? '—'}`}</span>
                {hit ? <span className="text-warning">{` · already sent to ${hit.email} on ${sheetDate(hit.sentAt.slice(0, 10))}`}</span> : null}
              </span>
              <span className="flex-none font-mono text-[12px] tabular-nums">{`₹${inr.format(r.amountInr)}`}</span>
              <span className={cn('w-[86px] flex-none text-right text-[11.5px]', r.status === 'received' ? 'text-positive' : 'text-ink-muted')}>
                {r.status === 'received' ? `received ${r.paidOn ? sheetDate(r.paidOn) : ''}` : 'open'}
              </span>
              <button type="button" className="grid size-6 flex-none place-items-center rounded text-ink-muted hover:bg-hover hover:text-danger" aria-label={`Remove ${r.clientName} ${r.invoiceNo ?? ''} from this email`} onClick={() => onToggle(r.id)}>
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          );
        })}
        {!kept.length ? <li className="px-2.5 py-1.5 text-[12.5px] text-ink-muted">No invoices left: this email is not sent.</li> : null}
      </ul>
      {out.length ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-line-soft px-2.5 py-1 text-[12px] text-ink-muted">
          Removed:
          {out.map((r) => (
            <button key={r.id} type="button" className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 hover:bg-hover hover:text-ink" title={everyEmail ? 'Put it back in every email' : 'Put it back in this email'} onClick={() => onToggle(r.id)}>
              {`${r.clientName} ${r.invoiceNo ?? ''}`}
              <RotateCcw className="size-3" aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
