'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { sheetDate } from '@/lib/receivables/dates';
import type { SnapshotRow } from '@/lib/receivables/model';
import type { SentHit } from '@/lib/receivables/sent-receipts';

/**
 * The invoices of one email in the Send email and Payment received pop-ups (owner, 18–19 Nov 2026).
 * The email's own table is where an invoice is removed: `RemovableRows` puts ✕ at the right of the
 * row under the pointer (or the caret), outside the email text, so the ✕ is never sent. With
 * `everyEmail` the invoice leaves every email of the send. Nothing on the sheet changes. A received
 * invoice already sent to this person shows amber, and the email cannot go until the person
 * removes it: it is never removed for them. `InvoicesInEmail` is the line above the email: the
 * count, the invoices already sent and the removed ones, each with ↺ to put it back.
 */
type Row = Pick<SnapshotRow, 'id' | 'clientName' | 'invoiceNo' | 'amountInr' | 'status' | 'paidOn'>;

export function InvoicesInEmail({ rows, removed, hits, onToggle, everyEmail = false }: { rows: Row[]; removed: string[]; hits: SentHit[]; onToggle: (id: string) => void; everyEmail?: boolean }) {
  const kept = rows.filter((r) => !removed.includes(r.id));
  const out = rows.filter((r) => removed.includes(r.id));
  const name = (id: string) => {
    const r = rows.find((x) => x.id === id);
    return r ? `${r.clientName} ${r.invoiceNo ?? ''}`.trim() : 'An invoice';
  };
  return (
    <section aria-label="Invoices in this email" className="grid gap-1 text-[12.5px]">
      <p className="text-ink-2">
        <b className="font-medium text-ink">{kept.length ? `${kept.length} invoice${kept.length === 1 ? '' : 's'} in this email` : 'No invoices left: this email is not sent'}</b>
        <span className="text-ink-muted">{everyEmail ? ' · ✕ on a row of the table removes it from every email in this send. The sheet does not change.' : ' · ✕ on a row of the table removes it from this email.'}</span>
      </p>
      {hits.length ? (
        <ul className="grid gap-0.5 text-warning">
          {hits.map((h) => (
            <li key={`${h.invoiceId}-${h.email}`}>{`⚠ ${name(h.invoiceId)} was already sent to ${h.email} on ${sheetDate(h.sentAt.slice(0, 10))}. Remove it to send.`}</li>
          ))}
        </ul>
      ) : null}
      {out.length ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
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

/**
 * Wraps the email body: the builder marks each invoice row with `data-inv`, and ✕ shows at the
 * right of the row under the pointer, a tap, or the caret. Rows in `hitIds` show amber. The ✕ and
 * the colour sit outside the body, so they never reach the sent email.
 */
export function RemovableRows({ children, onRemove, hitIds, labelOf }: { children: ReactNode; onRemove: (id: string) => void; hitIds: string[]; labelOf: (id: string) => string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const [at, setAt] = useState<{ id: string; top: number } | null>(null);
  const show = (node: Node | null) => {
    const el = node instanceof Element ? node : (node?.parentElement ?? null);
    const tr = el?.closest('tr[data-inv]') as HTMLElement | null;
    if (!tr || !wrap.current) return;
    const w = wrap.current.getBoundingClientRect();
    const r = tr.getBoundingClientRect();
    setAt({ id: tr.dataset.inv!, top: r.top - w.top + r.height / 2 - 12 });
  };
  const caret = () => show(document.getSelection()?.anchorNode ?? null);
  return (
    // The handlers only place the ✕; the keyboard reaches it from the caret in the email body.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={wrap}
      data-rm={scope}
      className="relative"
      onMouseMove={(e) => show(e.target as Node)}
      onClick={(e) => show(e.target as Node)}
      onKeyUp={caret}
      onScrollCapture={() => setAt(null)}
      onMouseLeave={() => setAt(null)}
    >
      {hitIds.length ? <style>{hitIds.map((id) => `[data-rm="${scope}"] tr[data-inv="${CSS.escape(id)}"] > td{background:#fff1cc !important;}`).join('')}</style> : null}
      {children}
      {at ? (
        <button
          type="button"
          style={{ top: at.top }}
          className="absolute right-2 grid size-6 place-items-center rounded-full border border-line bg-surface-raised text-ink-muted shadow-sm hover:border-danger hover:text-danger"
          aria-label={`Remove ${labelOf(at.id)} from the email`}
          title="Remove this invoice from the email"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onRemove(at.id);
            setAt(null);
          }}
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
