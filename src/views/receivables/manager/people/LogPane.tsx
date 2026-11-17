'use client';

import { RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { EmailLogDto, PeopleDto } from '@/lib/receivables/v2-wire';
import { cn } from '@/lib/utils';
import { ERROR_LABEL, KIND_LABEL, ROW_BTN, errorText, stamp, type PeopleActions } from './shared';

/**
 * The Log sub-tab: the last 50 emails, one dense line each. The line reads: status mark, time,
 * kind, recipient, subject, sender, the WhatsApp nudge, and Retry on a failed or skipped email.
 */

const STATUS: Record<EmailLogDto['status'], { mark: string; text: string; tone: string }> = {
  sent: { mark: '✓', text: 'Sent', tone: 'text-positive' },
  failed: { mark: '✗', text: 'Failed', tone: 'text-danger' },
  sending: { mark: '…', text: 'Sending', tone: 'text-info' },
  skipped: { mark: '–', text: 'Skipped', tone: 'text-ink-faint' },
};
const WA: Record<string, { text: string; tone: string }> = {
  sent: { text: 'WA ✓', tone: 'text-positive' },
  failed: { text: 'WA ✗', tone: 'text-danger' },
  no_phone: { text: 'WA no phone', tone: 'text-warning' },
  disabled: { text: 'WA off', tone: 'text-ink-faint' },
};

export function LogPane({ people, act }: { people: PeopleDto; act: PeopleActions }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface-raised">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-surface-sunken px-4 py-2 text-[12.5px]">
        <span className="font-semibold uppercase tracking-[.04em] text-ink-muted">Last 50 emails</span>
        <span className="text-ink-muted">
          {'Next roll-up '}
          <b className="font-medium text-ink">{people.nextRollupAt ? stamp(people.nextRollupAt) : 'Off'}</b>
        </span>
        <span className="text-ink-muted">
          {'Next digest '}
          <b className="font-medium text-ink">{people.nextDigestAt ? stamp(people.nextDigestAt) : 'Off'}</b>
        </span>
      </div>
      <ul aria-label="Email log" className="overflow-x-auto">
        {people.emailLog.map((l) => (
          <LogRow key={l.id} log={l} retrying={act.retryEmail.isPending} onRetry={() => act.retryEmail.mutate(l.id, { onSuccess: () => toastSuccess('Sending again', 'From your Outlook.'), onError: (e) => toastError('Not retried', errorText(e)) })} />
        ))}
        {!people.emailLog.length ? <li className="px-4 py-3 text-center text-[13px] text-ink-muted">No emails yet.</li> : null}
      </ul>
    </div>
  );
}

function LogRow({ log, onRetry, retrying }: { log: EmailLogDto; onRetry: () => void; retrying: boolean }) {
  const st = STATUS[log.status] ?? STATUS.skipped;
  const wa = log.whatsappStatus ? WA[log.whatsappStatus] : null;
  const error = log.error ? (ERROR_LABEL[log.error] ?? log.error) : null;
  return (
    <li className="flex h-10 min-w-[720px] items-center gap-3 border-b border-line-soft px-4 text-[13px] last:border-b-0">
      <span className={cn('w-3 text-center font-semibold', st.tone)} title={st.text}>
        <span aria-hidden>{st.mark}</span>
        <span className="sr-only">{st.text}</span>
      </span>
      <span className="w-[108px] shrink-0 whitespace-nowrap font-mono text-[11.5px] tabular-nums text-ink-muted">{stamp(log.sentAt ?? log.createdAt)}</span>
      <span className="w-[76px] shrink-0 whitespace-nowrap font-medium">{KIND_LABEL[log.kind] ?? log.kind}</span>
      <span className="w-[150px] shrink-0 truncate" title={[...log.to, ...log.cc].join(', ')}>
        {`→ ${log.recipientName || log.to.join(', ')}`}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink-2" title={log.subject}>
        {log.subject}
      </span>
      {error ? (
        <span className={cn('max-w-[180px] shrink-0 truncate text-[11.5px]', st.tone)} title={error}>
          {error}
        </span>
      ) : null}
      <span className="w-[100px] shrink-0 truncate text-ink-muted" title={log.senderName ? `From ${log.senderName}` : undefined}>
        {log.senderName ?? '—'}
      </span>
      <span className={cn('w-[78px] shrink-0 whitespace-nowrap text-[11.5px]', wa?.tone ?? 'text-ink-faint')}>{wa?.text ?? '—'}</span>
      <span className="w-[62px] shrink-0 text-right">
        {log.status === 'failed' || log.status === 'skipped' ? (
          <Button size="sm" variant="secondary" className={ROW_BTN} disabled={retrying} onClick={onRetry} aria-label={`Retry the ${KIND_LABEL[log.kind] ?? log.kind} email to ${log.recipientName || log.to.join(', ')}`}>
            <RotateCw aria-hidden />
            Retry
          </Button>
        ) : null}
      </span>
    </li>
  );
}
