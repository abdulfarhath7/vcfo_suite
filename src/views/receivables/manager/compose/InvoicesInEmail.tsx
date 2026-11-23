'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, RotateCcw, X } from 'lucide-react';
import { sheetDate } from '@/lib/receivables/dates';
import type { SnapshotRow } from '@/lib/receivables/model';
import type { SentHit } from '@/lib/receivables/sent-receipts';

/**
 * The invoices of one email in the Send email and Payment received pop-ups (owner, 18–19 Nov 2026).
 * The email's own table is where an invoice is removed: `RemovableRows` puts ✕ at the right of the
 * row under the pointer (or the caret), outside the email text, so the ✕ is never sent. With
 * `everyEmail` the invoice leaves every email of the send. Nothing on the sheet changes. A received
 * invoice already sent to this person shows amber as a warning; the email can still go (owner,
 * 23 Nov 2026). `InvoicesInEmail` is the line above the email: the
 * count, the invoices already sent and the removed ones, each with ↺ to put it back. With `panel`
 * (Send email, several emails) the Removed panel lists every invoice removed in the send, the emails
 * it is out of, and puts it back in every email or in the email in view only (owner, 19 Nov 2026).
 */
type Row = Pick<SnapshotRow, 'id' | 'clientName' | 'invoiceNo' | 'amountInr' | 'status' | 'paidOn'>;

/** One invoice removed in the send, as the Removed panel of one email shows it. */
export type RemovedItem = {
  id: string;
  label: string;
  amountInr: number;
  /** The emails it is out of, by name ("Leaders", "Priya"). */
  outOf: string[];
  /** How many emails of the send hold it at all. */
  holders: number;
  /** The email in view holds it (so ↺ This email can put it back). */
  inThis: boolean;
  /** Already put back in the email in view. */
  backHere: boolean;
};
type Panel = { items: RemovedItem[]; onAll: (id: string) => void; onHere: (id: string) => void };
const inrFull = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function InvoicesInEmail({
  rows,
  removed,
  hits,
  onToggle,
  everyEmail = false,
  panel,
}: {
  rows: Row[];
  removed: string[];
  hits: SentHit[];
  onToggle: (id: string) => void;
  everyEmail?: boolean;
  panel?: Panel;
}) {
  const [open, setOpen] = useState(true);
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
          {/* One line per invoice, with everyone who already got it (owner, 23 Nov 2026). */}
          {[...new Set(hits.map((h) => h.invoiceId))].map((id) => {
            const mine = hits.filter((h) => h.invoiceId === id);
            return <li key={id}>{`⚠ ${name(id)} was already sent to ${mine.map((h) => h.email).join(', ')} on ${sheetDate(mine[0]!.sentAt.slice(0, 10))}.`}</li>;
          })}
        </ul>
      ) : null}
      {panel && panel.items.length ? (
        <div className="rounded-md border border-line bg-surface-sunken">
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12.5px] font-medium text-ink">
            {`Removed from this send (${panel.items.length})`}
            <ChevronDown aria-hidden className={`ml-auto size-3.5 text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open ? (
            <ul className="max-h-[22vh] overflow-y-auto border-t border-line-soft">
              {panel.items.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line-soft px-2.5 py-1.5 first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <b className="font-medium text-ink">{it.label}</b>
                    <span className="text-ink-muted">{` · ₹${inrFull.format(it.amountInr)}`}</span>
                    <span className="block text-[11.5px] text-ink-muted">
                      {it.backHere
                        ? `Back in this email · still out of ${it.outOf.join(', ') || 'no other email'}`
                        : it.outOf.length === it.holders
                          ? `Out of all ${it.holders} email${it.holders === 1 ? '' : 's'} that hold it${it.holders > 1 ? `: ${it.outOf.join(', ')}` : ''}`
                          : `Out of ${it.outOf.join(', ')}`}
                      {it.inThis ? '' : ' · not in this email'}
                    </span>
                  </span>
                  <button type="button" className="inline-flex h-6 items-center gap-1 rounded border border-line bg-surface-raised px-2 text-[12px] text-ink hover:bg-hover" onClick={() => panel.onAll(it.id)}>
                    <RotateCcw className="size-3" aria-hidden />
                    All emails
                  </button>
                  <button
                    type="button"
                    disabled={!it.inThis || it.backHere}
                    title={!it.inThis ? 'This email does not hold this invoice (a partner gets only their own clients).' : it.backHere ? 'Already back in this email' : 'Put it back in this email only'}
                    className="inline-flex h-6 items-center gap-1 rounded border border-line bg-surface-raised px-2 text-[12px] text-ink hover:bg-hover disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-surface-raised"
                    onClick={() => panel.onHere(it.id)}
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    This email
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {!panel && out.length ? (
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
