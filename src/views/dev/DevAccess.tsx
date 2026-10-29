'use client';

import { useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Chip } from '@/components/ui/spectrum-chip';
import { DevCard, KeyValue, Pending, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { stamp } from '@/lib/dev/format';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import type { AccessPayload, StaffAccessRow } from '@/lib/dev/types';

/**
 * Access: staff accounts with role, status, last seen, two-step sign-in and open sessions.
 * Client accounts are counted only; the console never lists a client by name.
 */

const roleLabel = (r: string) => ROLE_UI_LABEL[r as Role] ?? r;
const ROLE_ORDER = ['super_admin', 'admin', 'manager', 'intern', 'developer', 'client'];

export default function DevAccess() {
  const q = useDevApi<AccessPayload>('/api/dev/access');
  const [tab, setTab] = useState('all');

  const staff = q.data?.staff ?? [];
  const noTwoStep = staff.filter((s) => s.status === 'active' && !s.twoStep);
  const inactive = staff.filter((s) => s.status !== 'active');
  const shown = tab === 'twostep' ? noTwoStep : tab === 'inactive' ? inactive : staff;

  const columns: EFilingColumn<StaffAccessRow>[] = [
    {
      key: 'name',
      header: 'Name',
      width: '28%',
      render: (s) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{s.name}</span>
          <span className="block truncate text-[12px] text-ink-muted">{s.email}</span>
        </span>
      ),
    },
    { key: 'role', header: 'Role', width: '150px', render: (s) => roleLabel(s.role) },
    { key: 'status', header: 'Status', width: '148px', render: (s) => <StatusChip status={s.status === 'active' ? 'ok' : 'off'} label={s.status === 'active' ? 'Active' : 'Inactive'} /> },
    {
      key: '2fa',
      header: 'Two-step sign-in',
      width: '148px',
      render: (s) => <Chip tone={s.twoStep ? 'ok' : 'warn'} className="w-[124px]">{s.twoStep ? 'On' : 'Off'}</Chip>,
    },
    { key: 'sessions', header: 'Sessions', width: '90px', align: 'right', render: (s) => <span className={s.activeSessions ? undefined : 'text-ink-muted'}>{s.activeSessions}</span> },
    { key: 'seen', header: 'Last seen', width: '140px', render: (s) => stamp(s.lastSeenAt) },
  ];

  const roles = [...(q.data?.roles ?? [])].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title="Staff sign-in"
        meta={q.data ? `${staff.length} accounts` : undefined}
        filters={
          <SpectrumTabs
            label="Show"
            items={[
              { key: 'all', label: 'All', count: staff.length },
              { key: 'twostep', label: 'Two-step off', count: noTwoStep.length },
              { key: 'inactive', label: 'Inactive', count: inactive.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        }
      >
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={columns} rows={shown} rowKey={(s) => s.id} pageSize={20} minWidth={900} empty="No accounts match" />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DevCard title="Client accounts" meta="Counted, not listed">
          {q.data ? (
            <KeyValue
              cols={2}
              rows={[
                { k: 'Active', v: q.data.clients.active },
                { k: 'Inactive', v: q.data.clients.inactive },
                { k: 'Two-step on', v: q.data.clients.twoStep },
                { k: 'Open sessions', v: q.data.clients.activeSessions },
              ]}
            />
          ) : (
            <Pending error={q.error} rows={2} />
          )}
        </DevCard>
        <DevCard title="Roles" meta="Active people">
          {q.data ? (
            <div className="px-2 pb-2">
              <EFilingGrid
                columns={[
                  { key: 'role', header: 'Role', render: (r: { role: string; people: number }) => <span className="font-medium text-ink">{roleLabel(r.role)}</span> },
                  { key: 'people', header: 'People', width: '100px', align: 'right', render: (r: { role: string; people: number }) => r.people },
                ]}
                rows={roles}
                rowKey={(r) => r.role}
                minWidth={320}
              />
            </div>
          ) : (
            <Pending error={q.error} rows={3} />
          )}
        </DevCard>
      </div>
    </div>
  );
}
