'use client';

import { useEffect, useRef, useState } from 'react';
import { Unplug } from 'lucide-react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { FilterChip } from '@/components/ui/filter-chip';
import { Button } from '@/components/ui/button';
import { DangerConfirm } from '@/components/ui/danger-confirm';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Tag } from '@/components/ui/spectrum-chip';
import { CloseButton, DevCard, EnvNames, KeyValue, ListRow, Pending, StatusChip, pickedRow, useDevAction } from '@/components/dev/parts';
import { DomainCard } from '@/components/dev/DomainCard';
import { uptimeLow } from '@/lib/dev/health';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { useDevApi } from '@/components/dev/use-dev-api';
import { daysUntil, stamp } from '@/lib/dev/format';
import { outlookHealth } from '@/lib/dev/parse';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import type { ConnectionDetailPayload, ConnectionsPayload, MessageRouteRow, OutlookConnectionRow, ServiceConfig, ServiceHealth, ServiceMeta } from '@/lib/dev/types';

/** "Auth expires": the date, amber within 15 days; "None" for a service that keeps no sign-in. */
function Expiry({ iso }: { iso: string | null | undefined }) {
  if (!iso) return <span className="text-ink-faint">None</span>;
  const soon = daysUntil(iso) <= 15;
  return <span className={soon ? 'font-medium text-warning' : undefined}>{stamp(iso)}</span>;
}

/**
 * Connections: each outside service's configured state (env var names, never values), its
 * account, last live check and sign-in expiry, and the Outlook mailboxes staff have linked.
 * "Test" runs one read-only live check and stores it (uptime, p95 and incidents read those
 * rows). Pick a service to see its facts and scopes, and for email and WhatsApp the domain
 * check, the message routes that use it, a test send and its recent events. `?c=<id>` opens
 * one from the overview (`?c=outlook` scrolls to the mailboxes). "Disconnect" on a mailbox
 * (R-40, type DISCONNECT) removes the link and writes the audit row.
 */
export default function DevConnections() {
  const q = useDevApi<ConnectionsPayload>('/api/dev/connections');
  const [tab, setTab] = useState('all');
  const [kind, setKind] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [drop, setDrop] = useState<OutlookConnectionRow | null>(null);
  const disconnect = useDevAction<{ id: string }>('/api/dev/connections/outlook/disconnect');
  const outlookRef = useRef<HTMLDivElement>(null);
  const check = useDevAction<{ service: string }>('/api/dev/connections/check');
  const [testing, setTesting] = useState<string | null>(null);

  // The overview links here with `?c=id`. Read once on mount; the page needs no Suspense for it.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (c === 'outlook') outlookRef.current?.scrollIntoView({ block: 'start' });
    else if (c) setPicked(c);
  }, []);

  const services = q.data?.services ?? [];
  const kinds = [...new Set(services.map((s) => s.kind))].sort();
  const ofKind = kind ? services.filter((s) => s.kind === kind) : services;
  const attention = ofKind.filter((s) => s.status === 'partial');
  const off = ofKind.filter((s) => s.status === 'off');
  const shown = tab === 'attention' ? attention : tab === 'off' ? off : ofKind;
  const cur = services.find((s) => s.id === picked) ?? null;
  const health = new Map<string, ServiceHealth>((q.data?.health ?? []).map((h) => [h.service, h]));
  const meta = new Map<string, ServiceMeta>((q.data?.meta ?? []).map((m) => [m.id, m]));

  const doTest = async (s: ServiceConfig) => {
    setTesting(s.id);
    try {
      const out = await check.run({ service: s.id });
      if (out.ok === false) {
        toastError('Test not run', out.error);
        return;
      }
      if (out.data.ok) toastSuccess('Test passed', s.name);
      else toastError('Test failed', s.name);
    } finally {
      setTesting(null);
    }
  };

  const doDisconnect = async () => {
    if (!drop) return;
    const out = await disconnect.run({ id: drop.id });
    if (out.ok === false) {
      toastError('Disconnect failed', out.error);
      return;
    }
    toastSuccess('Mailbox disconnected', drop.person);
  };

  const columns: EFilingColumn<ServiceConfig>[] = [
    {
      key: 'name',
      header: 'Service',
      width: '32%',
      render: (s) => (
        <span className="block min-w-0">
          <button
            type="button"
            className="text-left font-medium text-ink hover:underline"
            aria-expanded={picked === s.id}
            onClick={(e) => {
              e.stopPropagation();
              setPicked((p) => (p === s.id ? null : s.id));
            }}
          >
            {s.name}
          </button>
          <span className="block truncate text-[12px] text-ink-muted">
            {s.kind} · {s.provider}
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '148px',
      render: (s) => <StatusChip status={s.status} />,
    },
    {
      key: 'account',
      header: 'Account',
      render: (s) => <span className="block min-w-[150px] truncate text-[12.5px]">{meta.get(s.id)?.account ?? <span className="text-ink-faint">-</span>}</span>,
    },
    {
      key: 'last',
      header: 'Last check',
      width: '140px',
      render: (s) => {
        const c = health.get(s.id)?.lastCheck;
        return c ? <span className={c.ok ? undefined : 'font-medium text-danger'}>{stamp(c.checkedAt)}</span> : <span className="text-ink-faint">-</span>;
      },
    },
    { key: 'exp', header: 'Auth expires', width: '140px', render: (s) => <Expiry iso={meta.get(s.id)?.authExpires} /> },
    {
      key: 'act',
      header: 'Action',
      width: '110px',
      align: 'right',
      render: (s) =>
        meta.get(s.id)?.checkable ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={check.busy}
            onClick={(e) => {
              e.stopPropagation();
              void doTest(s);
            }}
          >
            {testing === s.id ? 'Testing' : 'Test'}
          </Button>
        ) : null,
    },
  ];

  const outlookColumns: EFilingColumn<OutlookConnectionRow>[] = [
    {
      key: 'person',
      header: 'Person',
      width: '26%',
      render: (o) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{o.person}</span>
          <span className="block truncate text-[12px] text-ink-muted">{ROLE_UI_LABEL[o.role as Role] ?? o.role}</span>
        </span>
      ),
    },
    {
      key: 'mailbox',
      header: 'Mailbox',
      width: '26%',
      render: (o) => o.mailbox,
    },
    {
      key: 'status',
      header: 'Status',
      width: '148px',
      render: (o) => <StatusChip status={outlookHealth(o).toLowerCase()} label={outlookHealth(o)} />,
    },
    {
      key: 'refresh',
      header: 'Last refresh',
      width: '140px',
      render: (o) => stamp(o.updatedAt),
    },
    {
      key: 'expires',
      header: 'Token expires',
      width: '140px',
      render: (o) => <span className={daysUntil(o.expiresAt) < 0 ? 'text-ink-muted' : undefined}>{stamp(o.expiresAt)}</span>,
    },
    {
      key: 'sig',
      header: 'Signature',
      width: '96px',
      render: (o) => (o.signatureEnabled ? 'On' : 'Off'),
    },
    {
      key: 'act',
      header: '',
      width: '130px',
      align: 'right',
      render: (o) => (
        <Button size="sm" variant="secondary" onClick={() => setDrop(o)} disabled={disconnect.busy}>
          Disconnect
        </Button>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title="Connected services"
        filters={
          <>
            <SpectrumTabs
              label="Show"
              items={[
                { key: 'all', label: 'All', count: ofKind.length },
                {
                  key: 'attention',
                  label: 'Needs attention',
                  count: attention.length,
                },
                { key: 'off', label: 'Not set up', count: off.length },
              ]}
              value={tab}
              onChange={setTab}
            />
            <FilterChip
              label="Kind"
              value={kind}
              onChange={setKind}
              options={kinds.map((k) => ({
                value: k,
                label: k,
                count: services.filter((s) => s.kind === k).length,
              }))}
            />
          </>
        }
      >
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid
              columns={columns}
              rows={shown}
              rowKey={(s) => s.id}
              pageSize={20}
              minWidth={900}
              empty="No services match"
              stickyFirstColumn
              onRowClick={(s) => setPicked((p) => (p === s.id ? null : s.id))}
              rowClassName={pickedRow((s: ServiceConfig) => s.id, picked)}
            />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      {cur ? (
        <ServiceDetail
          key={cur.id}
          service={cur}
          meta={meta.get(cur.id) ?? null}
          health={health.get(cur.id) ?? null}
          testing={testing === cur.id}
          onTest={meta.get(cur.id)?.checkable ? () => void doTest(cur) : undefined}
          onClose={() => setPicked(null)}
        />
      ) : null}

      <div ref={outlookRef} className="scroll-mt-4">
        <DevCard title="Outlook mailboxes" meta={q.data ? `${q.data.outlook.length} linked` : undefined}>
          {q.data ? (
            <div className="px-2 pb-2">
              <EFilingGrid
                columns={outlookColumns}
                rows={q.data.outlook}
                rowKey={(o) => o.id}
                pageSize={20}
                minWidth={990}
                empty="No mailbox is linked"
                stickyFirstColumn
              />
            </div>
          ) : (
            <Pending error={q.error} />
          )}
        </DevCard>
      </div>

      <DangerConfirm
        open={drop !== null}
        onOpenChange={(o) => (o ? null : setDrop(null))}
        title={`Disconnect ${drop?.person ?? 'this mailbox'}?`}
        body="Mail from the app stops leaving this mailbox until the person connects it again from their profile."
        word="DISCONNECT"
        confirm="Disconnect"
        icon={Unplug}
        onConfirm={doDisconnect}
      />
    </div>
  );
}

const routeColumns: EFilingColumn<MessageRouteRow>[] = [
  { key: 'event', header: 'Message', render: (r) => <span className="font-mono text-[13px] text-ink">{r.event}</span> },
  { key: 'tpl', header: 'Template', width: '24%', render: (r) => <span className="font-mono text-[12.5px] text-ink-muted">{r.template ?? '-'}</span> },
  { key: 'sent', header: 'Sent 7 days', width: '110px', align: 'right', render: (r) => r.sent7d },
  { key: 'failed', header: 'Failed', width: '90px', align: 'right', render: (r) => <span className={r.failed7d ? 'font-medium text-danger' : 'text-ink-muted'}>{r.failed7d}</span> },
];

/** The picked service: facts and scopes, then the sections its kind has. */
function ServiceDetail({
  service,
  meta,
  health,
  testing,
  onTest,
  onClose,
}: {
  service: ServiceConfig;
  meta: ServiceMeta | null;
  health: ServiceHealth | null;
  testing: boolean;
  onTest?: () => void;
  onClose: () => void;
}) {
  const url = `/api/dev/connections/detail?service=${service.id}`;
  const d = useDevApi<ConnectionDetailPayload>(url);
  const send = useDevAction<{ to: string }>('/api/dev/connections/test-send');
  const [to, setTo] = useState('');
  const last = health?.lastCheck ?? null;

  const doSend = async () => {
    const out = await send.run({ to: to.trim() });
    if (out.ok === false) {
      toastError('Test not sent', out.error);
      return;
    }
    toastSuccess('Test sent', to.trim());
    setTo('');
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title={service.name}
        meta={service.provider}
        right={
          <>
            <StatusChip status={service.status} />
            <CloseButton onClick={onClose} />
          </>
        }
      >
        <KeyValue
          rows={[
            { k: 'Endpoint', v: meta?.endpoint ?? '-', mono: Boolean(meta?.endpoint) },
            { k: 'Account', v: meta?.account ?? '-' },
            { k: 'Last check', v: last ? `${stamp(last.checkedAt)} · ${last.ok ? 'passed' : 'failed'}` : '-' },
            { k: 'Auth expires', v: <Expiry iso={meta?.authExpires} /> },
            {
              k: 'Uptime, 30 days',
              v: health?.uptime == null ? '-' : <span className={uptimeLow(health.uptime) ? 'font-medium text-warning' : undefined}>{`${health.uptime}% of ${health.checks} checks`}</span>,
            },
            { k: 'p95', v: health?.p95 == null ? '-' : `${health.p95.toLocaleString('en-IN')} ms` },
            { k: 'Set', v: <EnvNames names={service.present} /> },
            { k: 'Missing', v: <EnvNames names={service.missing} tone={service.missing.length ? 'danger' : 'muted'} /> },
          ]}
        />
        <div className="px-4 pb-4">
          <div className="text-[12px] text-ink-muted">Scopes</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {(meta?.scopes ?? []).map((sc) => (
              <Tag key={sc} className="font-mono font-medium">
                {sc}
              </Tag>
            ))}
          </div>
        </div>
        {onTest ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-4 py-3">
            <Button size="sm" variant="secondary" onClick={onTest} disabled={testing}>
              {testing ? 'Testing' : 'Test'}
            </Button>
          </div>
        ) : null}
      </DevCard>

      {service.id === 'email' ? <DomainCard domain={d.data?.domain} error={d.error} queryUrl={url} /> : null}

      {d.data && d.data.usedBy.length ? (
        <DevCard title="Used by" meta="Last 7 days">
          <div className="px-2 pb-2">
            <EFilingGrid columns={routeColumns} rows={d.data.usedBy} rowKey={(r) => `${r.event}-${r.channel}`} minWidth={560} stickyFirstColumn />
          </div>
        </DevCard>
      ) : null}

      {d.data?.canSendTest && service.status !== 'off' ? (
        <DevCard title="Send a test">
          <form
            className="flex flex-wrap items-center gap-2 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (to.trim()) void doSend();
            }}
          >
            <Input aria-label="Send to" type="email" placeholder="Send to" value={to} onChange={(e) => setTo(e.target.value)} className="h-[30px] min-w-0 flex-1 text-[13px] sm:max-w-[320px]" />
            <Button size="sm" type="submit" disabled={!to.trim() || send.busy}>
              {send.busy ? 'Sending' : 'Send a test'}
            </Button>
          </form>
        </DevCard>
      ) : null}

      <DevCard title="Recent events">
        {!d.data ? (
          <Pending error={d.error} rows={3} />
        ) : d.data.events.length ? (
          d.data.events.map((ev) => (
            <ListRow key={ev.id}>
              <span className="w-[130px] flex-none text-[12.5px] text-ink-muted">{stamp(ev.at)}</span>
              <span className="min-w-0 flex-1 truncate">{ev.text}</span>
              <StatusChip status={ev.ok ? 'ok' : 'failed'} label={ev.ok ? 'OK' : 'Failed'} />
            </ListRow>
          ))
        ) : (
          <div className="p-4">
            <EmptyState title="No events yet" />
          </div>
        )}
      </DevCard>
    </div>
  );
}
