'use client';

import { useState } from 'react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Chip } from '@/components/ui/spectrum-chip';
import { Tag } from '@/components/ui/spectrum-chip';
import { Button } from '@/components/ui/button';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import { DangerConfirm } from '@/components/ui/danger-confirm';
import { Trash2 } from 'lucide-react';
import { Cols, Col, DevCard, KeyValue, Pending, SettingRow, StackedBar, StatusChip, useDevAction } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { ApiTokensCard } from '@/components/dev/ApiTokensCard';
import { stamp } from '@/lib/dev/format';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { describeUserAgent } from '@/views/settings/account/device-label';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import type { AccessExtra, AccessPayload, DevSessionRow, StaffAccessRow } from '@/lib/dev/types';

type Secret = AccessExtra['secrets'][number];
type Account = AccessExtra['accounts'][number];

const secretColumns: EFilingColumn<Secret>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (x) => (
      <span className="block min-w-0">
        <span className="block truncate font-mono text-[13px] font-medium text-ink">{x.name}</span>
        <span className="block truncate text-[12px] text-ink-muted">{x.scope}</span>
      </span>
    ),
  },
  { key: 'where', header: 'Stored in', width: '160px', render: (x) => x.storedIn },
  { key: 'value', header: 'Value', width: '140px', render: (x) => <span className="font-mono text-ink-muted">{x.set ? '•••• ••••' : '-'}</span> },
  { key: 'status', header: 'Status', width: '148px', render: (x) => <StatusChip status={x.set ? 'ok' : 'failed'} label={x.set ? 'Set' : 'Missing'} /> },
];

const accountColumns: EFilingColumn<Account>[] = [
  { key: 'acct', header: 'Account', render: (a) => <span className="font-mono text-[13px] text-ink">{a.account}</span> },
  { key: 'kind', header: 'Kind', width: '24%', render: (a) => a.kind },
  {
    key: 'can',
    header: 'Can',
    width: '34%',
    wrap: true,
    render: (a) => (
      <span className="flex flex-wrap gap-1">
        {a.can.map((c) => (
          <Tag key={c} className="font-mono">
            {c}
          </Tag>
        ))}
      </span>
    ),
  },
  { key: 'used', header: 'Last used', width: '140px', render: (a) => stamp(a.lastUsed) },
];

/**
 * Access: staff accounts with role, status, last seen, two-step sign-in and open sessions.
 * Client accounts are counted only; the console never lists a client by name.
 */

const roleLabel = (r: string) => ROLE_UI_LABEL[r as Role] ?? r;
const ROLE_ORDER = ['super_admin', 'admin', 'manager', 'intern', 'developer', 'client'];

export default function DevAccess() {
  const q = useDevApi<AccessPayload & AccessExtra>('/api/dev/access');
  const [tab, setTab] = useState('all');
  const revoke = useDevAction<{ sessionId: string }>('/api/dev/access/revoke');
  const purge = useDevAction<Record<string, never>>('/api/dev/access/purge-demo');
  const [asking, setAsking] = useState<DevSessionRow | null>(null);
  const [purging, setPurging] = useState(false);

  const doRevoke = async (row: DevSessionRow) => {
    const out = await revoke.run({ sessionId: row.id });
    if (out.ok === false) {
      toastError('Not signed out', out.error);
      return;
    }
    setAsking(null);
    toastSuccess('Signed out', row.person);
  };

  const doPurge = async () => {
    const out = await purge.run({});
    if (out.ok === false) {
      toastError('Purge failed', out.error);
      return;
    }
    toastSuccess('Demo logins turned off', `${String(out.data.accounts ?? 0)} accounts`);
  };

  const sessionColumns: EFilingColumn<DevSessionRow>[] = [
    {
      key: 'person',
      header: 'Person',
      width: '24%',
      render: (x) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{x.person}</span>
          <span className="block truncate text-[12px] text-ink-muted">{roleLabel(x.role)}</span>
        </span>
      ),
    },
    { key: 'device', header: 'Device', width: '120px', render: (x) => describeUserAgent(x.userAgent).split(' on ')[1] ?? '-' },
    { key: 'browser', header: 'Browser', width: '110px', render: (x) => describeUserAgent(x.userAgent).split(' on ')[0] },
    { key: 'place', header: 'Address', width: '120px', render: (x) => <span className="font-mono text-[12.5px] text-ink-muted">{x.ip ?? '-'}</span> },
    { key: 'since', header: 'Since', width: '130px', render: (x) => stamp(x.createdAt) },
    { key: 'active', header: 'Active', width: '130px', render: (x) => stamp(x.lastSeenAt) },
    {
      key: 'act',
      header: '',
      width: '110px',
      align: 'right',
      render: (x) =>
        x.current ? (
          <Tag tone="prog">You</Tag>
        ) : (
          <Button size="sm" variant="secondary" disabled={revoke.busy} onClick={() => setAsking(x)}>
            Revoke
          </Button>
        ),
    },
  ];

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

      <DevCard title="Sessions signed in now" meta={q.data ? `${q.data.sessions.length} staff devices` : undefined}>
        {q.data ? (
          <>
            <div className="px-2 pb-2">
              <EFilingGrid columns={sessionColumns} rows={q.data.sessions} rowKey={(x) => x.id} pageSize={20} minWidth={900} empty="No staff device is signed in" stickyFirstColumn />
            </div>
            {asking ? (
              <InlineConfirm
                question={`Sign out ${asking.person} on ${describeUserAgent(asking.userAgent)}?`}
                confirm="Revoke"
                busy={revoke.busy}
                onConfirm={() => void doRevoke(asking)}
                onCancel={() => setAsking(null)}
              />
            ) : null}
          </>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

      {q.data ? <ApiTokensCard tokens={q.data.tokens} /> : null}

      <Cols>
        <Col>
          <DevCard title="Secrets and API keys" meta={q.data ? (q.data.secretsSource === 'app_runner' ? 'Values never shown · from App Runner' : 'Values never shown · this server') : 'Values never shown'}>
            {q.data ? (
              <>
                <div className="px-2 pb-2">
                  <EFilingGrid columns={secretColumns} rows={q.data.secrets} rowKey={(x) => x.name} minWidth={640} stickyFirstColumn />
                </div>
                <SettingRow label="Seeded demo logins" sub={q.data.demoLogins ? `${q.data.demoLogins} can still sign in` : 'None can sign in'}>
                  <Button size="sm" variant="destructive" disabled={!q.data.demoLogins || purge.busy} onClick={() => setPurging(true)}>
                    Purge
                  </Button>
                </SettingRow>
              </>
            ) : (
              <Pending error={q.error} />
            )}
          </DevCard>
          <DevCard title="Service accounts">
            {q.data ? (
              <div className="px-2 pb-2">
                <EFilingGrid columns={accountColumns} rows={q.data.accounts} rowKey={(a) => a.account} minWidth={720} empty="No service account is set up" stickyFirstColumn />
              </div>
            ) : (
              <Pending error={q.error} rows={2} />
            )}
          </DevCard>
        </Col>
        <Col>
          <DevCard title="Sign-in methods" meta="People, last 30 days">
            {q.data ? (
              <StackedBar
                total={q.data.methods.twoStep + q.data.methods.passwordOnly}
                segments={[
                  { label: 'Password and code', value: q.data.methods.twoStep, tone: 'navy' },
                  { label: 'Password only', value: q.data.methods.passwordOnly, tone: 'prog' },
                ]}
              />
            ) : (
              <Pending error={q.error} rows={2} />
            )}
          </DevCard>
          <DevCard title="Sign-in rules">
            <SettingRow label="Staff two-step" sub="Each person turns it on in Profile">
              <span className="text-[13px] text-ink-muted">Not required</span>
            </SettingRow>
            <SettingRow label="Session length">
              <span className="text-[13px] text-ink">30 days</span>
            </SettingRow>
          </DevCard>
        </Col>
      </Cols>

      <DangerConfirm
        open={purging}
        onOpenChange={setPurging}
        title="Turn off the seeded demo logins?"
        body="Every @vcfo.local account except yours becomes inactive and its devices sign out. Nothing is deleted."
        word="PURGE"
        confirm="Purge"
        icon={Trash2}
        onConfirm={doPurge}
      />
    </div>
  );
}
