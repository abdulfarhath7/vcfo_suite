'use client';

import { useEffect, useRef, useState } from 'react';
import { Unplug } from 'lucide-react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { FilterChip } from '@/components/ui/filter-chip';
import { Button } from '@/components/ui/button';
import { DangerConfirm } from '@/components/ui/danger-confirm';
import { CloseButton, DevCard, EnvNames, KeyValue, Pending, StatusChip, pickedRow, useDevAction } from '@/components/dev/parts';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { useDevApi } from '@/components/dev/use-dev-api';
import { daysUntil, stamp } from '@/lib/dev/format';
import { outlookHealth } from '@/lib/dev/parse';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import type { ConnectionsPayload, OutlookConnectionRow, ServiceConfig } from '@/lib/dev/types';

/**
 * Connections: each outside service's configured state (env var names, never values) and
 * the Outlook mailboxes staff have linked. Pick a service row to see which names are set;
 * `?c=<service id>` opens one from the overview (`?c=outlook` scrolls to the mailboxes).
 * "Disconnect" on a mailbox (R-40, type DISCONNECT) removes the link and writes the audit row.
 */
export default function DevConnections() {
  const q = useDevApi<ConnectionsPayload>('/api/dev/connections');
  const [tab, setTab] = useState('all');
  const [kind, setKind] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [drop, setDrop] = useState<OutlookConnectionRow | null>(null);
  const disconnect = useDevAction<{ id: string }>('/api/dev/connections/outlook/disconnect');
  const outlookRef = useRef<HTMLDivElement>(null);

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
      key: 'what',
      header: 'Does',
      render: (s) => <span className="text-[13px]">{s.what}</span>,
    },
    {
      key: 'set',
      header: 'Set',
      width: '70px',
      align: 'right',
      render: (s) => `${s.present.length}`,
    },
    {
      key: 'missing',
      header: 'Missing',
      width: '70px',
      align: 'right',
      render: (s) => <span className={s.missing.length && s.status === 'partial' ? 'font-medium text-danger' : undefined}>{s.missing.length}</span>,
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
              minWidth={720}
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
        <DevCard
          title={cur.name}
          meta={cur.provider}
          right={
            <>
              <StatusChip status={cur.status} />
              <CloseButton onClick={() => setPicked(null)} />
            </>
          }
        >
          <KeyValue
            cols={2}
            rows={[
              { k: 'Set', v: <EnvNames names={cur.present} /> },
              {
                k: 'Missing',
                v: <EnvNames names={cur.missing} tone={cur.missing.length ? 'danger' : 'muted'} />,
              },
            ]}
          />
        </DevCard>
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
