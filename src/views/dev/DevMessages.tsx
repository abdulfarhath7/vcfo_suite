'use client';

import { useEffect, useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Tag } from '@/components/ui/spectrum-chip';
import { DevCard, LoadOlder, Pending, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { stamp, words } from '@/lib/dev/format';
import type { DeliveryRow, EmailLogRow, MessagesPayload } from '@/lib/dev/types';

/**
 * Messages: the notification delivery log (email and WhatsApp) and the checklist mail log.
 * Addresses arrive masked from the server; nothing here can unmask them.
 */

const STATUS_TABS = ['all', 'failed', 'skipped', 'sent'] as const;

function query(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Keep pages loaded with "Load older" until a filter changes. */
function useOlder<T extends { id: string }>(key: string) {
  const [extra, setExtra] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setExtra([]);
    setCursor(undefined);
  }, [key]);
  return { extra, setExtra, cursor, setCursor, busy, setBusy };
}

export default function DevMessages() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('all');
  const [channel, setChannel] = useState<'all' | 'email' | 'whatsapp'>('all');
  const filters = { status: status === 'all' ? undefined : status, channel: channel === 'all' ? undefined : channel };
  const url = `/api/dev/messages${query(filters)}`;
  const q = useDevApi<MessagesPayload>(url);

  const del = useOlder<DeliveryRow>(url);
  const mail = useOlder<EmailLogRow>(url);
  const delCursor = del.cursor === undefined ? q.data?.nextBefore.deliveries : del.cursor;
  const mailCursor = mail.cursor === undefined ? q.data?.nextBefore.emails : mail.cursor;

  const loadOlder = async (which: 'deliveries' | 'emails') => {
    const st = which === 'deliveries' ? del : mail;
    const before = which === 'deliveries' ? delCursor : mailCursor;
    if (!before) return;
    st.setBusy(true);
    try {
      const res = await fetch(`/api/dev/messages${query({ ...filters, only: which, [`${which}Before`]: before })}`, { cache: 'no-store' });
      if (!res.ok) return;
      const page = (await res.json()) as MessagesPayload;
      if (which === 'deliveries') {
        del.setExtra((x) => [...x, ...page.deliveries]);
        del.setCursor(page.nextBefore.deliveries);
      } else {
        mail.setExtra((x) => [...x, ...page.emails]);
        mail.setCursor(page.nextBefore.emails);
      }
    } finally {
      st.setBusy(false);
    }
  };

  const deliveries = [...(q.data?.deliveries ?? []), ...del.extra];
  const emails = [...(q.data?.emails ?? []), ...mail.extra];
  const c = q.data?.counts24h;

  const deliveryColumns: EFilingColumn<DeliveryRow>[] = [
    { key: 'at', header: 'Time', width: '140px', render: (m) => stamp(m.createdAt) },
    { key: 'channel', header: 'Channel', width: '120px', render: (m) => <Tag tone={m.channel === 'whatsapp' ? 'teal' : 'prog'} className="w-[104px]">{m.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</Tag> },
    { key: 'event', header: 'Event', render: (m) => <span className="font-mono text-[13px]">{m.event}</span> },
    { key: 'to', header: 'To', width: '18%', render: (m) => m.to || <span className="text-ink-faint">-</span> },
    { key: 'status', header: 'Status', width: '148px', render: (m) => <StatusChip status={m.status} /> },
    {
      key: 'why',
      header: 'Reason',
      width: '16%',
      render: (m) => <span className="text-[13px] text-ink-muted">{m.errorCode ?? (m.skipReason ? words(m.skipReason) : '-')}</span>,
    },
  ];

  const emailColumns: EFilingColumn<EmailLogRow>[] = [
    { key: 'at', header: 'Time', width: '140px', render: (m) => stamp(m.createdAt) },
    { key: 'event', header: 'Event', render: (m) => <span className="font-mono text-[13px]">{m.event}</span> },
    { key: 'item', header: 'Step', width: '22%', render: (m) => <span className="font-mono text-[13px]">{m.item}</span> },
    { key: 'status', header: 'Status', width: '148px', render: (m) => <StatusChip status={m.status} /> },
    { key: 'reason', header: 'Reason', width: '22%', render: (m) => <span className="text-[13px] text-ink-muted">{m.reason ?? '-'}</span> },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title="Outbound messages"
        meta={c ? `24 hours · ${c.sent} sent · ${c.failed} failed · ${c.skipped} skipped` : undefined}
        filters={
          <>
            <SpectrumTabs
              label="Channel"
              items={[
                { key: 'all', label: 'All channels' },
                { key: 'email', label: 'Email' },
                { key: 'whatsapp', label: 'WhatsApp' },
              ]}
              value={channel}
              onChange={(k) => setChannel(k as typeof channel)}
            />
            <SpectrumTabs
              label="Status"
              items={STATUS_TABS.map((k) => ({ key: k, label: k === 'all' ? 'All' : words(k) }))}
              value={status}
              onChange={(k) => setStatus(k as typeof status)}
            />
          </>
        }
      >
        {q.data ? (
          <>
            <div className="px-2 pb-2">
              <EFilingGrid columns={deliveryColumns} rows={deliveries} rowKey={(m) => m.id} pageSize={25} minWidth={860} empty="No messages match" />
            </div>
            {delCursor ? <LoadOlder onClick={() => void loadOlder('deliveries')} busy={del.busy} /> : null}
          </>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      {channel !== 'whatsapp' ? (
        <DevCard title="Checklist mail log" meta="Mail bound to a step">
          {q.data ? (
            <>
              <div className="px-2 pb-2">
                <EFilingGrid columns={emailColumns} rows={emails} rowKey={(m) => m.id} pageSize={25} minWidth={760} empty="No mail matches" />
              </div>
              {mailCursor ? <LoadOlder onClick={() => void loadOlder('emails')} busy={mail.busy} /> : null}
            </>
          ) : (
            <Pending error={q.error} />
          )}
        </DevCard>
      ) : null}
    </div>
  );
}
