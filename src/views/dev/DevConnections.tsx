'use client';

import { useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { CloseButton, DevCard, EnvNames, KeyValue, Pending, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { daysUntil, stamp } from '@/lib/dev/format';
import { outlookHealth } from '@/lib/dev/parse';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import type { ConnectionsPayload, OutlookConnectionRow, ServiceConfig } from '@/lib/dev/types';

/**
 * Connections: each outside service's configured state (env var names, never values) and
 * the Outlook mailboxes staff have linked. Pick a service row to see which names are set.
 */
export default function DevConnections() {
  const q = useDevApi<ConnectionsPayload>('/api/dev/connections');
  const [tab, setTab] = useState('all');
  const [picked, setPicked] = useState<string | null>(null);

  const services = q.data?.services ?? [];
  const attention = services.filter((s) => s.status === 'partial');
  const off = services.filter((s) => s.status === 'off');
  const shown = tab === 'attention' ? attention : tab === 'off' ? off : services;
  const cur = services.find((s) => s.id === picked) ?? null;

  const columns: EFilingColumn<ServiceConfig>[] = [
    {
      key: 'name',
      header: 'Service',
      width: '32%',
      render: (s) => (
        <span className="block min-w-0">
          <button type="button" className="text-left font-medium text-ink hover:underline" aria-expanded={picked === s.id} onClick={(e) => { e.stopPropagation(); setPicked((p) => (p === s.id ? null : s.id)); }}>
            {s.name}
          </button>
          <span className="block truncate text-[12px] text-ink-muted">{s.provider}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', width: '148px', render: (s) => <StatusChip status={s.status} /> },
    { key: 'what', header: 'Does', render: (s) => <span className="text-[13px]">{s.what}</span> },
    { key: 'set', header: 'Set', width: '70px', align: 'right', render: (s) => `${s.present.length}` },
    { key: 'missing', header: 'Missing', width: '70px', align: 'right', render: (s) => <span className={s.missing.length && s.status === 'partial' ? 'font-medium text-danger' : undefined}>{s.missing.length}</span> },
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
    { key: 'mailbox', header: 'Mailbox', width: '26%', render: (o) => o.mailbox },
    { key: 'status', header: 'Status', width: '148px', render: (o) => <StatusChip status={outlookHealth(o).toLowerCase()} label={outlookHealth(o)} /> },
    { key: 'refresh', header: 'Last refresh', width: '140px', render: (o) => stamp(o.updatedAt) },
    {
      key: 'expires',
      header: 'Token expires',
      width: '140px',
      render: (o) => <span className={daysUntil(o.expiresAt) < 0 ? 'text-ink-muted' : undefined}>{stamp(o.expiresAt)}</span>,
    },
    { key: 'sig', header: 'Signature', width: '96px', render: (o) => (o.signatureEnabled ? 'On' : 'Off') },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title="Connected services"
        filters={
          <SpectrumTabs
            label="Show"
            items={[
              { key: 'all', label: 'All', count: services.length },
              { key: 'attention', label: 'Needs attention', count: attention.length },
              { key: 'off', label: 'Not set up', count: off.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={columns} rows={shown} rowKey={(s) => s.id} pageSize={20} minWidth={720} empty="No services match" onRowClick={(s) => setPicked((p) => (p === s.id ? null : s.id))} />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      {cur ? (
        <DevCard title={cur.name} meta={cur.provider} right={<><StatusChip status={cur.status} /><CloseButton onClick={() => setPicked(null)} /></>}>
          <KeyValue
            cols={2}
            rows={[
              { k: 'Set', v: <EnvNames names={cur.present} /> },
              { k: 'Missing', v: <EnvNames names={cur.missing} tone={cur.missing.length ? 'danger' : 'muted'} /> },
            ]}
          />
        </DevCard>
      ) : null}

      <DevCard title="Outlook mailboxes" meta={q.data ? `${q.data.outlook.length} linked` : undefined}>
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={outlookColumns} rows={q.data.outlook} rowKey={(o) => o.id} pageSize={20} minWidth={860} empty="No mailbox is linked" />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>
    </div>
  );
}
