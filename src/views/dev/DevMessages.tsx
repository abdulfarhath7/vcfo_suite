'use client';

import { useEffect, useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Tag } from '@/components/ui/spectrum-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { CloseButton, DevCard, KeyValue, ListRow, LoadOlder, Pending, ReachNotice, StatusChip, pickedRow, useDevAction } from '@/components/dev/parts';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { DomainCard } from '@/components/dev/DomainCard';
import { useDevApi } from '@/components/dev/use-dev-api';
import { stamp, words } from '@/lib/dev/format';
import { cronWords } from '@/lib/dev/parse';
import type { DeliveryRow, EmailLogRow, EmailTemplateRow, FailedEmailRow, MessageRouteRow, MessagesPayload, MessagesSetupPayload, WhatsAppTemplate } from '@/lib/dev/types';

/**
 * Messages: the notification delivery log (email and WhatsApp) with a preview of the picked
 * message, the checklist mail log, and the setup cards: message routes with 7-day numbers,
 * timing, failed messages by cause, the mail domain check and the templates. Addresses arrive
 * masked from the server; nothing here can unmask them. Bodies are not stored, so the
 * preview shows the delivery facts only.
 */

const STEPS = ['queued', 'sent', 'delivered', 'read'] as const;

/** Queued, Sent, Delivered, Read: each dot is on when the stored status has reached it. */
function DeliverySteps({ status }: { status: string }) {
  const reached = status === 'failed' || status === 'skipped' ? 0 : STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4">
      {STEPS.map((st, i) => (
        <li key={st} className="flex items-center gap-2 text-[13px]">
          <i className={cn('h-2.5 w-2.5 rounded-full', i <= reached ? (i === reached ? 'bg-brand' : 'bg-positive-mid') : 'bg-upcoming-mid')} aria-hidden />
          <span className={i <= reached ? 'text-ink' : 'text-ink-muted'}>{words(st)}</span>
        </li>
      ))}
      {status === 'failed' || status === 'skipped' ? <StatusChip status={status} /> : null}
    </ol>
  );
}

const routeColumns: EFilingColumn<MessageRouteRow>[] = [
  { key: 'event', header: 'Message', render: (r) => <span className="font-mono text-[13px] text-ink">{r.event}</span> },
  {
    key: 'channel',
    header: 'Channel',
    width: '120px',
    render: (r) => (
      <Tag tone={r.channel === 'whatsapp' ? 'teal' : 'prog'} className="w-[104px]">
        {r.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
      </Tag>
    ),
  },
  { key: 'tpl', header: 'Template', width: '22%', render: (r) => <span className="font-mono text-[12.5px] text-ink-muted">{r.template ?? '-'}</span> },
  { key: 'sent', header: '7 days', width: '90px', align: 'right', render: (r) => r.sent7d },
  {
    key: 'deliv',
    header: 'Delivered',
    width: '100px',
    align: 'right',
    render: (r) => (r.sent7d ? `${Math.round((r.delivered7d / r.sent7d) * 100)}%` : <span className="text-ink-faint">-</span>),
  },
  { key: 'failed', header: 'Failed', width: '80px', align: 'right', render: (r) => <span className={r.failed7d ? 'font-medium text-danger' : 'text-ink-muted'}>{r.failed7d}</span> },
];

const failedColumns: EFilingColumn<FailedEmailRow>[] = [
  { key: 'at', header: 'Failed', width: '140px', render: (m) => stamp(m.lastAttemptAt) },
  {
    key: 'subject',
    header: 'Subject',
    render: (m) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink">{m.subject}</span>
        <span className="block truncate font-mono text-[12px] text-ink-muted">{m.templateKey ?? '-'}</span>
      </span>
    ),
  },
  { key: 'to', header: 'To', width: '20%', render: (m) => m.to },
  { key: 'tries', header: 'Tries', width: '70px', align: 'right', render: (m) => m.attempts },
  { key: 'why', header: 'Error', width: '22%', render: (m) => <span className="text-[13px] text-ink-muted">{m.error ?? '-'}</span> },
];

const waColumns: EFilingColumn<WhatsAppTemplate>[] = [
  { key: 'name', header: 'Template', render: (t) => <span className="font-mono text-[13px] text-ink">{t.name}</span> },
  { key: 'lang', header: 'Language', width: '110px', render: (t) => t.language || '-' },
  { key: 'cat', header: 'Category', width: '130px', render: (t) => words(t.category || '-') },
  { key: 'status', header: 'Status', width: '148px', render: (t) => <StatusChip status={t.status.toLowerCase() === 'approved' ? 'ok' : 'pending'} label={words(t.status || 'Unknown')} /> },
];

const mailColumns: EFilingColumn<EmailTemplateRow>[] = [
  { key: 'name', header: 'Template', render: (t) => <span className="font-medium text-ink">{t.name}</span> },
  { key: 'status', header: 'Status', width: '148px', render: (t) => <StatusChip status={t.active ? 'ok' : 'off'} label={t.active ? 'Active' : 'Off'} /> },
  { key: 'since', header: 'Changed', width: '120px', render: (t) => stamp(t.updatedAt).split(',')[0] },
  { key: 'last', header: 'Last used', width: '140px', render: (t) => stamp(t.lastUsed) },
  { key: 'sent', header: 'Sent 7 days', width: '110px', align: 'right', render: (t) => t.sent7d },
];

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

/** The tab count from the per-status delivery counts; "All" sums them. Undefined until loaded. */
function statusCount(counts: Record<string, number> | undefined, key: string): number | undefined {
  if (!counts) return undefined;
  return key === 'all' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[key] ?? 0);
}

export default function DevMessages() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('all');
  const [channel, setChannel] = useState<'all' | 'email' | 'whatsapp'>('all');
  const filters = { status: status === 'all' ? undefined : status, channel: channel === 'all' ? undefined : channel };
  const url = `/api/dev/messages${query(filters)}`;
  const q = useDevApi<MessagesPayload>(url);
  const setup = useDevApi<MessagesSetupPayload>('/api/dev/messages/setup');
  const [picked, setPicked] = useState<string | null>(null);
  const [routeChannel, setRouteChannel] = useState<'all' | 'email' | 'whatsapp'>('all');
  const [tplTab, setTplTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const [failedPick, setFailedPick] = useState<string | null>(null);
  const retry = useDevAction<{ id: string }>('/api/dev/messages/retry');

  /* R-40: the retry sends the kept mail once more; the route audits every try. */
  const doRetry = async (m: FailedEmailRow) => {
    const out = await retry.run({ id: m.id });
    if (out.ok === false) {
      toastError('Retry failed', out.error);
      return;
    }
    setFailedPick(null);
    toastSuccess('Sent again', m.to);
  };

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
  const cur = deliveries.find((m) => m.id === picked) ?? null;
  const st = setup.data;
  const failedCur = (st?.failedEmails ?? []).find((m) => m.id === failedPick) ?? null;
  const routes = (st?.routes ?? []).filter((r) => routeChannel === 'all' || r.channel === routeChannel);

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
              items={STATUS_TABS.map((k) => ({ key: k, label: k === 'all' ? 'All' : words(k), count: statusCount(q.data?.statusCounts, k) }))}
              value={status}
              onChange={(k) => setStatus(k as typeof status)}
            />
          </>
        }
      >
        {q.data ? (
          <>
            <div className="px-2 pb-2">
              <EFilingGrid
                columns={deliveryColumns}
                rows={deliveries}
                rowKey={(m) => m.id}
                pageSize={25}
                minWidth={860}
                empty="No messages match"
                onRowClick={(m) => setPicked((p) => (p === m.id ? null : m.id))}
                rowClassName={pickedRow((m: DeliveryRow) => m.id, picked)}
              />
            </div>
            {delCursor ? <LoadOlder onClick={() => void loadOlder('deliveries')} busy={del.busy} /> : null}
          </>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      {cur ? (
        <DevCard title="Message" meta={`${cur.event} · ${stamp(cur.createdAt)}`} right={<CloseButton onClick={() => setPicked(null)} />}>
          <DeliverySteps status={cur.status} />
          <KeyValue
            rows={[
              { k: 'Channel', v: cur.channel === 'whatsapp' ? 'WhatsApp' : 'Email' },
              { k: 'To', v: cur.to || '-' },
              { k: 'Queued', v: stamp(cur.createdAt) },
              { k: 'Last update', v: stamp(cur.updatedAt) },
              { k: 'Status', v: <StatusChip status={cur.status} /> },
              { k: 'Template', v: cur.template ?? '-', mono: Boolean(cur.template) },
              { k: 'Error', v: cur.errorCode ?? (cur.skipReason ? words(cur.skipReason) : '-'), mono: Boolean(cur.errorCode) },
            ]}
          />
        </DevCard>
      ) : null}

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

      <DevCard title="Failed mail" meta={st ? `${st.failedEmails.length} kept · 30 days` : undefined}>
        {st ? (
          <div className="px-2 pb-2">
            <EFilingGrid
              columns={failedColumns}
              rows={st.failedEmails}
              rowKey={(m) => m.id}
              pageSize={10}
              minWidth={820}
              empty="No failed mail in 30 days"
              stickyFirstColumn
              onRowClick={(m) => setFailedPick((p) => (p === m.id ? null : m.id))}
              rowClassName={pickedRow((m: FailedEmailRow) => m.id, failedPick)}
            />
          </div>
        ) : (
          <Pending error={setup.error} rows={3} />
        )}
      </DevCard>

      {failedCur ? (
        <DevCard
          title="Failed mail"
          meta={stamp(failedCur.lastAttemptAt)}
          right={
            <>
              {failedCur.canRetry ? (
                <Button size="sm" onClick={() => void doRetry(failedCur)} disabled={retry.busy}>
                  {retry.busy ? 'Sending' : 'Retry'}
                </Button>
              ) : (
                <span className="text-[12.5px] text-ink-muted">Had attachments</span>
              )}
              <CloseButton onClick={() => setFailedPick(null)} />
            </>
          }
        >
          <DeliverySteps status="failed" />
          <KeyValue
            rows={[
              { k: 'Channel', v: 'Email' },
              { k: 'To', v: failedCur.to },
              { k: 'Queued', v: stamp(failedCur.createdAt) },
              { k: 'Status', v: <StatusChip status="failed" /> },
              { k: 'Retries', v: Math.max(0, failedCur.attempts - 1) },
              { k: 'Template', v: failedCur.templateKey ?? '-', mono: Boolean(failedCur.templateKey) },
              { k: 'Subject', v: failedCur.subject },
              { k: 'Error', v: failedCur.error ?? '-' },
            ]}
          />
        </DevCard>
      ) : null}

      <DevCard
        title="Message routes"
        meta="Last 7 days"
        filters={
          <SpectrumTabs
            label="Channel"
            items={[
              { key: 'all', label: 'All' },
              { key: 'email', label: 'Email' },
              { key: 'whatsapp', label: 'WhatsApp' },
            ]}
            value={routeChannel}
            onChange={(k) => setRouteChannel(k as typeof routeChannel)}
          />
        }
      >
        {st ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={routeColumns} rows={routes} rowKey={(r) => `${r.event}-${r.channel}`} minWidth={720} stickyFirstColumn />
          </div>
        ) : (
          <Pending error={setup.error} />
        )}
      </DevCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DevCard title="Failed in 24 hours" meta={st ? `${st.causes.reduce((a, x) => a + x.count, 0)} messages` : undefined}>
          {!st ? (
            <Pending error={setup.error} rows={3} />
          ) : st.causes.length ? (
            st.causes.map((x) => (
              <ListRow key={`${x.channel}-${x.cause}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[13px] text-ink">{x.cause === 'no_code' ? 'No error code' : x.cause}</span>
                  <span className="block truncate text-[12.5px] text-ink-muted">{x.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
                </span>
                <b className="font-medium tabular-nums text-danger">{x.count}</b>
              </ListRow>
            ))
          ) : (
            <div className="p-4">
              <EmptyState title="Nothing failed in 24 hours" />
            </div>
          )}
        </DevCard>
        <DomainCard domain={st?.domain} error={setup.error} queryUrl="/api/dev/messages/setup" />
      </div>

      <DevCard title="Timing" meta={st ? st.timing.timezone : undefined}>
        {st ? (
          <KeyValue
            rows={[
              { k: 'Deadline reminders', v: st.timing.reminderDays.length ? `${[...st.timing.reminderDays].sort((a, b) => b - a).join(', ')} days before` : 'None' },
              ...st.timing.schedules.map((j) => ({ k: j.id, v: `${cronWords(j.cron)} · ${j.cron}` })),
            ]}
          />
        ) : (
          <Pending error={setup.error} rows={2} />
        )}
      </DevCard>

      <DevCard
        title="Templates"
        filters={
          <SpectrumTabs
            label="Channel"
            items={[
              { key: 'whatsapp', label: 'WhatsApp', count: st?.whatsappTemplates.state === 'ok' ? st.whatsappTemplates.data.length : undefined },
              { key: 'email', label: 'Email', count: st?.emailTemplates.length },
            ]}
            value={tplTab}
            onChange={(k) => setTplTab(k as typeof tplTab)}
          />
        }
      >
        {!st ? (
          <Pending error={setup.error} />
        ) : tplTab === 'email' ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={mailColumns} rows={st.emailTemplates} rowKey={(t) => t.id} pageSize={20} minWidth={640} empty="No mail templates" stickyFirstColumn />
          </div>
        ) : st.whatsappTemplates.state === 'ok' ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={waColumns} rows={st.whatsappTemplates.data} rowKey={(t) => `${t.name}-${t.language}`} pageSize={20} minWidth={600} empty="No templates on the account" stickyFirstColumn />
          </div>
        ) : (
          <ReachNotice reach={st.whatsappTemplates} service="WhatsApp templates" />
        )}
      </DevCard>
    </div>
  );
}
