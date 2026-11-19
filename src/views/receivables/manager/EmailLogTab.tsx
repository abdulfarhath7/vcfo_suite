'use client';

import { useEffect, useState } from 'react';
import { RotateCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { FilterSelect } from '@/components/ui/native-select';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { useEmailLog, useEmailLogEntry } from '@/hooks/use-receivables-v2';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { AUTO_EMAIL_KINDS, MANUAL_EMAIL_KINDS, isAutoEmail, type EmailKind, type EmailLogDto, type EmailLogFilter, type EmailStatus } from '@/lib/receivables/v2-wire';
import { cn } from '@/lib/utils';
import { stamp } from '../format';
import { ERROR_LABEL, KIND_LABEL, ROW_BTN, TD, TH, errorText } from './people/shared';

/**
 * The Email log tab (owner, 19 Nov 2026): every email the sheet sent, automatic and manual, in
 * one table, newest first. Automatic emails go out without anyone clicking Send (new invoice and
 * revised after an approval, the roll-up and the digest on their schedule); manual ones are the
 * Send email, Payment received and Send statement emails. Filters: who sent it (all, automatic,
 * manual), the email type, the status and a search on the subject, name or address. A click on a
 * row opens the email as it was sent. A failed automatic email or statement can be sent again
 * with Retry; a failed Send email goes again from the Sheet tab, which checks the invoices first.
 */

const STATUS: Record<EmailStatus, { mark: string; text: string; tone: string }> = {
  sent: { mark: '✓', text: 'Sent', tone: 'text-positive' },
  failed: { mark: '✗', text: 'Failed', tone: 'text-danger' },
  sending: { mark: '…', text: 'Sending', tone: 'text-info' },
  skipped: { mark: '–', text: 'Not sent', tone: 'text-ink-muted' },
};
const WA: Record<string, string> = { sent: 'WhatsApp sent', failed: 'WhatsApp failed', no_phone: 'No WhatsApp number', disabled: 'WhatsApp off' };

const KIND_OPTIONS = [{ value: '', label: 'All types' }, ...[...MANUAL_EMAIL_KINDS, ...AUTO_EMAIL_KINDS].map((k) => ({ value: k, label: KIND_LABEL[k] }))];
const STATUS_OPTIONS = [{ value: '', label: 'Any status' }, ...(['sent', 'failed', 'sending', 'skipped'] as const).map((s) => ({ value: s, label: STATUS[s].text }))];

const canRetry = (l: EmailLogDto) => (l.status === 'failed' || l.status === 'skipped') && l.kind !== 'summary';
const errorOf = (l: EmailLogDto) => (l.error ? (ERROR_LABEL[l.error] ?? l.error) : null);

export function EmailLogTab({ sheetId }: { sheetId: string }) {
  const [origin, setOrigin] = useState<'all' | 'auto' | 'manual'>('all');
  const [kind, setKind] = useState<EmailKind | ''>('');
  const [status, setStatus] = useState<EmailStatus | ''>('');
  const [typed, setTyped] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  // The search waits for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setQ(typed.trim()), 300);
    return () => clearTimeout(t);
  }, [typed]);
  const filter: EmailLogFilter = { origin: origin === 'all' ? undefined : origin, kind: kind || undefined, status: status || undefined, q: q || undefined };
  const { query, retry } = useEmailLog(sheetId, filter);
  const rows = query.data?.pages.flatMap((p) => p.rows) ?? [];
  const kinds = KIND_OPTIONS.filter((o) => !o.value || origin === 'all' || isAutoEmail(o.value as EmailKind) === (origin === 'auto'));
  const onRetry = (l: EmailLogDto) =>
    retry.mutate(l.id, { onSuccess: () => toastSuccess('Sending again', 'From your Outlook.'), onError: (e) => toastError('Not sent again', errorText(e)) });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SpectrumTabs
          label="Who sent it"
          items={[
            { key: 'all', label: 'All emails' },
            { key: 'auto', label: 'Automatic' },
            { key: 'manual', label: 'Manual' },
          ]}
          value={origin}
          onChange={(k) => {
            setOrigin(k as typeof origin);
            if (kind && k !== 'all' && isAutoEmail(kind) !== (k === 'auto')) setKind('');
          }}
        />
        <FilterSelect aria-label="Email type" options={kinds} value={kind} onChange={(e) => setKind(e.target.value as EmailKind | '')} />
        <FilterSelect aria-label="Status" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value as EmailStatus | '')} />
        <div className="relative ml-auto w-full max-w-[320px]">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-muted" />
          <Input aria-label="Search the emails" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search subject, name or email" className="h-8 pl-8 text-[13px]" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface-raised">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              <th className={cn(TH, 'w-[150px]')}>Time</th>
              <th className={cn(TH, 'w-[170px]')}>Email</th>
              <th className={cn(TH, 'w-[220px]')}>To</th>
              <th className={TH}>Subject</th>
              <th className={cn(TH, 'w-[130px]')}>From</th>
              <th className={cn(TH, 'w-[170px]')}>Status</th>
              <th className={cn(TH, 'w-[80px]')}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const st = STATUS[l.status] ?? STATUS.skipped;
              const err = errorOf(l);
              const to = [...l.to, ...l.cc].join(', ');
              return (
                <tr key={l.id} className="cursor-pointer hover:bg-hover" onClick={() => setOpen(l.id)}>
                  <td className={cn(TD, 'whitespace-nowrap tabular-nums text-ink-2')}>{stamp(l.sentAt ?? l.createdAt)}</td>
                  <td className={TD}>
                    <div className="font-medium text-ink">{KIND_LABEL[l.kind] ?? l.kind}</div>
                    <div className="text-[11.5px] text-ink-muted">{isAutoEmail(l.kind) ? 'Automatic' : 'Manual'}</div>
                  </td>
                  <td className={cn(TD, 'max-w-[220px]')}>
                    <div className="truncate text-ink" title={to}>
                      {l.recipientName || l.to.join(', ')}
                    </div>
                    <div className="truncate text-[11.5px] text-ink-muted" title={to}>
                      {l.cc.length ? `${l.to.length + l.cc.length} people · ${l.cc.length} in Cc` : l.to.join(', ')}
                    </div>
                  </td>
                  <td className={cn(TD, 'max-w-0')}>
                    {/* The button keeps the row reachable from the keyboard; the row click is a shortcut. */}
                    <button type="button" className="block w-full truncate text-left text-ink hover:underline" title={l.subject} onClick={(e) => (e.stopPropagation(), setOpen(l.id))}>
                      {l.subject}
                    </button>
                    {l.invoiceCount ? <div className="text-[11.5px] text-ink-muted">{`${l.invoiceCount} invoice${l.invoiceCount === 1 ? '' : 's'}`}</div> : null}
                  </td>
                  <td className={cn(TD, 'truncate text-ink-2')}>{l.senderName ?? '—'}</td>
                  <td className={TD}>
                    <div className={cn('font-medium', st.tone)}>
                      <span aria-hidden>{`${st.mark} `}</span>
                      {st.text}
                    </div>
                    {err ? (
                      <div className={cn('truncate text-[11.5px]', st.tone)} title={err}>
                        {err}
                      </div>
                    ) : l.whatsappStatus ? (
                      <div className="text-[11.5px] text-ink-muted">{WA[l.whatsappStatus] ?? l.whatsappStatus}</div>
                    ) : null}
                  </td>
                  <td className={cn(TD, 'text-right')} onClick={(e) => e.stopPropagation()}>
                    {canRetry(l) ? (
                      <Button size="sm" variant="secondary" className={ROW_BTN} disabled={retry.isPending} onClick={() => onRetry(l)} aria-label={`Send the ${KIND_LABEL[l.kind]} email to ${l.recipientName || l.to.join(', ')} again`}>
                        <RotateCw aria-hidden />
                        Retry
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {query.isLoading ? <p className="px-4 py-6 text-center text-[13px] text-ink-muted">Loading the emails…</p> : null}
        {query.error ? <p className="px-4 py-6 text-center text-[13px] text-danger">{query.error.message}</p> : null}
        {!query.isLoading && !query.error && !rows.length ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-muted">{filter.origin || filter.kind || filter.status || filter.q ? 'No emails match these filters.' : 'No emails yet.'}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-between text-[12.5px] text-ink-muted">
        <span>{rows.length ? `${rows.length} email${rows.length === 1 ? '' : 's'} shown, newest first` : ''}</span>
        {query.hasNextPage ? (
          <Button size="sm" variant="secondary" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? 'Loading…' : 'Show older emails'}
          </Button>
        ) : null}
      </div>

      {open ? <EmailViewer id={open} row={rows.find((r) => r.id === open)} onClose={() => setOpen(null)} onRetry={onRetry} retrying={retry.isPending} /> : null}
    </div>
  );
}

/** A whole HTML page for the frame: the Send email body is a fragment, so it is wrapped. */
const page = (html: string) =>
  /^\s*<!DOCTYPE/i.test(html) ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:16px;background:#fff;">${html}</body></html>`;

function EmailViewer({ id, row, onClose, onRetry, retrying }: { id: string; row?: EmailLogDto; onClose: () => void; onRetry: (l: EmailLogDto) => void; retrying: boolean }) {
  const entry = useEmailLogEntry(id);
  const e = entry.data;
  const l = e ?? row;
  const st = l ? (STATUS[l.status] ?? STATUS.skipped) : null;
  const err = l ? errorOf(l) : null;
  const facts: Array<[string, string]> = l
    ? [
        ['Email', `${KIND_LABEL[l.kind] ?? l.kind} · ${isAutoEmail(l.kind) ? 'Automatic' : 'Manual'}`],
        ['To', l.to.join(', ') || '—'],
        ...(l.cc.length ? ([['Cc', l.cc.join(', ')]] as Array<[string, string]>) : []),
        ['From', l.senderName ? `${l.senderName}'s Outlook` : '—'],
        ['Time', `${stamp(l.createdAt)}${l.sentAt ? ` · sent ${stamp(l.sentAt)}` : ''}`],
        ...(l.invoiceCount ? ([['Invoices', String(l.invoiceCount)]] as Array<[string, string]>) : []),
      ]
    : [];
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={l?.subject ?? 'Email'}
      size="xl"
      className="max-w-[min(1200px,96vw)]"
      footer={
        <>
          {l && canRetry(l) ? (
            <Button variant="secondary" disabled={retrying} onClick={() => onRetry(l)}>
              <RotateCw aria-hidden className="size-3.5" />
              Retry
            </Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="grid gap-3">
        {l ? (
          <dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-3 gap-y-1 text-[13px]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="break-words text-ink">{v}</dd>
              </div>
            ))}
            <dt className="text-ink-muted">Status</dt>
            <dd className={cn('font-medium', st?.tone)}>
              {st?.text}
              {err ? <span className="font-normal">{` · ${err}`}</span> : null}
              {l.kind === 'summary' && (l.status === 'failed' || l.status === 'skipped') ? <span className="font-normal text-ink-muted"> · Send it again from Send email on the Sheet tab.</span> : null}
            </dd>
          </dl>
        ) : null}
        {entry.isLoading ? <p className="py-10 text-center text-[13px] text-ink-muted">Loading the email…</p> : null}
        {entry.error ? <p className="py-10 text-center text-[13px] text-danger">{entry.error.message}</p> : null}
        {e ? (
          e.html ? (
            <iframe title={`The email: ${e.subject}`} sandbox="" srcDoc={page(e.html)} className="h-[60vh] w-full rounded border border-line-soft bg-white" />
          ) : (
            <p className="py-6 text-center text-[13px] text-ink-muted">This email was logged without its body.</p>
          )
        ) : null}
      </div>
    </Modal>
  );
}
