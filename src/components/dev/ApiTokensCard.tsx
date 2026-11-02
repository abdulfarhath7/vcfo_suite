'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/ui/copy-button';
import { DangerConfirm } from '@/components/ui/danger-confirm';
import { ChangeConfirm as ChangeRow } from '@/components/ui/inline-confirm';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { DevCard, StatusChip, useDevAction } from '@/components/dev/parts';
import { daysUntil, stamp } from '@/lib/dev/format';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { DevTokenRow } from '@/lib/dev/types';

/**
 * Access › API tokens: personal tokens that read the console's GET routes as the developer who
 * made them (`Authorization: Bearer vcfo_dev_…`). "New token" shows the token once. "Rotate"
 * (R-40, type ROTATE) makes a new one and keeps the old one working for 24 hours; "Revoke"
 * asks in place with the before and after.
 */
export function ApiTokensCard({ tokens }: { tokens: DevTokenRow[] }) {
  const create = useDevAction<{ name: string; days: number }>('/api/dev/access/tokens');
  const rotate = useDevAction<{ id: string }>('/api/dev/access/tokens/rotate');
  const revoke = useDevAction<{ id: string }>('/api/dev/access/tokens/revoke');
  const [making, setMaking] = useState(false);
  const [name, setName] = useState('');
  const [days, setDays] = useState('90');
  const [shown, setShown] = useState<string | null>(null);
  const [rotating, setRotating] = useState<DevTokenRow | null>(null);
  const [revoking, setRevoking] = useState<DevTokenRow | null>(null);

  const doCreate = async () => {
    const out = await create.run({ name: name.trim(), days: Number(days) });
    if (out.ok === false) {
      toastError('Token not made', out.error);
      return;
    }
    setShown(String(out.data.token ?? ''));
    setMaking(false);
    setName('');
  };

  const doRotate = async () => {
    if (!rotating) return;
    const out = await rotate.run({ id: rotating.id });
    if (out.ok === false) {
      toastError('Not rotated', out.error);
      return;
    }
    setShown(String(out.data.token ?? ''));
    toastSuccess('Key rotated', 'The old token works for 24 hours');
  };

  const doRevoke = async () => {
    if (!revoking) return;
    const out = await revoke.run({ id: revoking.id });
    if (out.ok === false) {
      toastError('Not revoked', out.error);
      return;
    }
    toastSuccess('Token revoked', revoking.name);
    setRevoking(null);
  };

  const columns: EFilingColumn<DevTokenRow>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (t) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{t.name}</span>
          <span className="block truncate font-mono text-[12px] text-ink-muted">{t.prefix}…</span>
        </span>
      ),
    },
    { key: 'by', header: 'Made by', width: '130px', render: (t) => t.by },
    { key: 'created', header: 'Created', width: '130px', render: (t) => stamp(t.createdAt) },
    {
      key: 'expires',
      header: 'Expires',
      width: '130px',
      render: (t) => <span className={t.status === 'active' && daysUntil(t.expiresAt) <= 15 ? 'font-medium text-warning' : undefined}>{stamp(t.expiresAt)}</span>,
    },
    { key: 'used', header: 'Last used', width: '130px', render: (t) => stamp(t.lastUsedAt) },
    {
      key: 'status',
      header: 'Status',
      width: '148px',
      render: (t) => <StatusChip status={t.status === 'active' ? 'ok' : t.status === 'expired' ? 'off' : 'failed'} label={t.status === 'active' ? 'Active' : t.status === 'expired' ? 'Expired' : 'Revoked'} />,
    },
    {
      key: 'act',
      header: '',
      width: '180px',
      align: 'right',
      render: (t) =>
        t.status === 'active' ? (
          <span className="flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setRotating(t)} disabled={rotate.busy}>
              Rotate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRevoking(t)} disabled={revoke.busy}>
              Revoke
            </Button>
          </span>
        ) : null,
    },
  ];

  return (
    <DevCard
      title="API tokens"
      meta="Read only · values shown once"
      right={
        <Button size="sm" onClick={() => setMaking((m) => !m)}>
          New token
        </Button>
      }
    >
      {making ? (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-surface-sunken px-4 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void doCreate();
          }}
        >
          <Input aria-label="Token name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="h-[30px] min-w-0 flex-1 text-[13px] sm:max-w-[260px]" />
          <SpectrumTabs
            label="Works for"
            items={[
              { key: '30', label: '30 days' },
              { key: '90', label: '90 days' },
            ]}
            value={days}
            onChange={setDays}
          />
          <Button size="sm" type="submit" disabled={!name.trim() || create.busy}>
            Make token
          </Button>
          <Button size="sm" variant="outline" type="button" onClick={() => setMaking(false)}>
            Cancel
          </Button>
        </form>
      ) : null}
      {shown ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-brand-soft/60 px-4 py-2.5">
          <code className="min-w-0 flex-1 break-all font-mono text-[12.5px] text-ink">{shown}</code>
          <CopyButton value={shown} label="Copy" />
          <Button size="sm" variant="ghost" onClick={() => setShown(null)}>
            Done
          </Button>
        </div>
      ) : null}
      <div className="px-2 pb-2">
        <EFilingGrid columns={columns} rows={tokens} rowKey={(t) => t.id} pageSize={10} minWidth={980} empty="No API tokens" stickyFirstColumn />
      </div>
      {revoking ? (
        <ChangeRow
          question={`Revoke the token ${revoking.name}?`}
          now="Active"
          after="Revoked"
          confirm="Revoke"
          busy={revoke.busy}
          onConfirm={() => void doRevoke()}
          onCancel={() => setRevoking(null)}
        />
      ) : null}
      <DangerConfirm
        open={rotating !== null}
        onOpenChange={(o) => (o ? null : setRotating(null))}
        title={`Rotate the token ${rotating?.name ?? ''}?`}
        body="A new token is made. The old token works for 24 hours."
        word="ROTATE"
        confirm="Rotate key"
        icon={RotateCw}
        onConfirm={doRotate}
      />
    </DevCard>
  );
}
