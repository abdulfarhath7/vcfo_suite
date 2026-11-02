'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { InlineConfirm } from '@/components/ui/inline-confirm';
import { Tag } from '@/components/ui/spectrum-chip';
import { ChangeConfirm, CloseButton, DevCard, KeyValue, Pending, ReachChip, ReachNotice, StatusChip, pickedRow, useDevAction } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { commitOf, duration, imageVersion, stamp, words } from '@/lib/dev/format';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { DeployImage, DeployOperation, DeploysExtra, DeploysPayload, FeatureFlag, MigrationRow } from '@/lib/dev/types';

const shortImage = (image: string) => image.split('/').pop() ?? image;

const migrationColumns: EFilingColumn<MigrationRow>[] = [
  { key: 'tag', header: 'Migration', render: (m) => <span className="font-mono text-[13px] text-ink">{m.tag}</span> },
  { key: 'what', header: 'What it does', width: '30%', render: (m) => words(m.tag.replace(/^\d+_/, '')) },
  { key: 'status', header: 'Status', width: '148px', render: (m) => <StatusChip status={m.status === 'applied' ? 'ok' : 'pending'} label={m.status === 'applied' ? 'Applied' : 'Waiting'} /> },
  { key: 'date', header: 'Made', width: '120px', render: (m) => (m.appliedAt ? stamp(m.appliedAt).split(',')[0] : '-') },
];

const flagColumns: EFilingColumn<FeatureFlag>[] = [
  {
    key: 'flag',
    header: 'Flag',
    render: (f) => (
      <span className="block min-w-0">
        <span className="block truncate font-medium text-ink">{f.name}</span>
        <span className="block truncate font-mono text-[12px] text-ink-muted">{f.id}</span>
      </span>
    ),
  },
  { key: 'env', header: 'Environment', width: '140px', render: () => <Tag tone="prog">Production</Tag> },
  { key: 'who', header: 'Who sees it', width: '28%', render: (f) => f.who },
  { key: 'on', header: 'On', width: '148px', render: (f) => <StatusChip status={f.on ? 'ok' : 'off'} label={f.on ? 'On' : 'Off'} /> },
];

/**
 * Deploys: the App Runner service (DescribeService) and its recent operations
 * (ListOperations) for APP_RUNNER_SERVICE_ARN. "Redeploy" (R-40, a change confirm) rolls out
 * the image the service already names through `POST /api/dev/deploys/redeploy`, which writes
 * the audit row. "Roll back" (R-40, asked in place) points the service at an image the
 * console saw it run before (App Runner keeps no image list, so the console records each one).
 * A pick on a history row opens its release facts. Migrations compare the code's journal with
 * the database; feature flags are the env switches.
 */
export default function DevDeploys() {
  const q = useDevApi<DeploysPayload & DeploysExtra>('/api/dev/deploys', { refetchMs: 60_000 });
  const rollback = useDevAction<{ image: string }>('/api/dev/deploys/rollback');
  const [asking, setAsking] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const redeploy = useDevAction<Record<string, never>>('/api/dev/deploys/redeploy');
  const [confirm, setConfirm] = useState(false);
  const svc = q.data?.service.state === 'ok' ? q.data.service.data : null;
  const version = svc ? imageVersion(svc.image) ?? svc.image ?? 'current image' : '';

  const doRedeploy = async () => {
    const out = await redeploy.run({});
    if (out.ok === false) {
      toastError('Redeploy refused', out.error);
      return;
    }
    toastSuccess('Redeploy started', version);
  };

  const doRollback = async (image: string) => {
    const out = await rollback.run({ image });
    if (out.ok === false) {
      toastError('Roll back refused', out.error);
      return;
    }
    setAsking(null);
    toastSuccess('Roll back started', shortImage(image));
  };

  const ops = q.data?.operations.state === 'ok' ? q.data.operations.data : [];
  const curOp = ops.find((o) => o.id === picked) ?? null;
  const images = q.data?.images ?? [];
  const earlier = images.filter((i) => !i.current);
  const waiting = q.data?.migrations.state === 'ok' ? q.data.migrations.data.filter((m) => m.status === 'pending').length : 0;

  const imageColumns: EFilingColumn<DeployImage>[] = [
    { key: 'image', header: 'Image', render: (i) => <span className="font-mono text-[12.5px] text-ink">{shortImage(i.image)}</span> },
    { key: 'first', header: 'First seen', width: '140px', render: (i) => stamp(i.firstSeenAt) },
    { key: 'last', header: 'Last seen', width: '140px', render: (i) => stamp(i.lastSeenAt) },
    {
      key: 'act',
      header: '',
      width: '120px',
      align: 'right',
      render: (i) =>
        i.current ? (
          <StatusChip status="ok" label="Running" />
        ) : (
          <Button size="sm" variant="secondary" disabled={rollback.busy || svc?.status !== 'RUNNING'} onClick={() => setAsking(i.image)}>
            Roll back
          </Button>
        ),
    },
  ];

  const columns: EFilingColumn<DeployOperation>[] = [
    { key: 'type', header: 'Operation', render: (o) => <span className="font-medium text-ink">{words(o.type)}</span> },
    { key: 'started', header: 'Started', width: '150px', render: (o) => stamp(o.startedAt) },
    { key: 'ended', header: 'Ended', width: '150px', render: (o) => stamp(o.endedAt) },
    { key: 'dur', header: 'Duration', width: '120px', render: (o) => duration(o.startedAt, o.endedAt) },
    { key: 'status', header: 'Status', width: '148px', render: (o) => <StatusChip status={o.status} /> },
    { key: 'id', header: 'ID', width: '18%', render: (o) => <span className="font-mono text-[12px] text-ink-muted">{o.id}</span> },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title="Production service"
        meta="App Runner"
        right={
          q.data ? (
            <span className="flex items-center gap-2">
              <ReachChip reach={q.data.service} />
              {svc ? (
                <Button size="sm" onClick={() => setConfirm(true)} disabled={redeploy.busy || svc.status !== 'RUNNING'}>
                  <RotateCw className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
                  Redeploy
                </Button>
              ) : null}
            </span>
          ) : null
        }
      >
        {!q.data ? (
          <Pending error={q.error} rows={2} />
        ) : q.data.service.state === 'ok' ? (
          <KeyValue
            cols={4}
            rows={[
              { k: 'Service', v: q.data.service.data.name || '-', mono: true },
              { k: 'Status', v: <StatusChip status={q.data.service.data.status} /> },
              { k: 'Address', v: q.data.service.data.url ?? '-', mono: true },
              { k: 'Image', v: q.data.service.data.image ?? '-', mono: true },
              { k: 'CPU', v: q.data.service.data.cpu ?? '-' },
              { k: 'Memory', v: q.data.service.data.memory ?? '-' },
              { k: 'Updated', v: stamp(q.data.service.data.updatedAt) },
            ]}
          />
        ) : (
          <ReachNotice reach={q.data.service} service="App Runner" />
        )}
      </DevCard>

      <DevCard title="Deploy history" meta="Last 20 operations">
        {!q.data ? (
          <Pending error={q.error} />
        ) : q.data.operations.state === 'ok' ? (
          <div className="px-2 pb-2">
            <EFilingGrid
              columns={columns}
              rows={q.data.operations.data}
              rowKey={(o) => o.id}
              pageSize={20}
              minWidth={820}
              empty="No operations yet"
              stickyFirstColumn
              onRowClick={(o) => setPicked((p) => (p === o.id ? null : o.id))}
              rowClassName={pickedRow((o: DeployOperation) => o.id, picked)}
            />
          </div>
        ) : (
          <ReachNotice reach={q.data.operations} service="App Runner" />
        )}
      </DevCard>
      {curOp ? (
        <DevCard title="Release" meta={words(curOp.type)} right={<CloseButton onClick={() => setPicked(null)} />}>
          <KeyValue
            cols={4}
            rows={[
              // App Runner does not say which image an operation rolled out, so only the newest one names it.
              { k: 'Commit', v: curOp.id === ops[0]?.id ? (commitOf(svc?.image) ?? '-') : '-', mono: true },
              { k: 'Deployed', v: stamp(curOp.endedAt ?? curOp.startedAt) },
              { k: 'Duration', v: duration(curOp.startedAt, curOp.endedAt) },
              { k: 'Status', v: <StatusChip status={curOp.status} /> },
              { k: 'Image', v: curOp.id === ops[0]?.id ? (svc?.image ?? '-') : '-', mono: true },
              { k: 'Operation ID', v: curOp.id, mono: true },
            ]}
          />
        </DevCard>
      ) : null}

      <DevCard title="Earlier images" meta="Roll back">
        {!q.data ? (
          <Pending error={q.error} rows={2} />
        ) : (
          <>
            <div className="px-2 pb-2">
              <EFilingGrid
                columns={imageColumns}
                rows={images}
                rowKey={(i) => i.image}
                minWidth={620}
                empty="No image seen yet"
                stickyFirstColumn
              />
            </div>
            {asking ? (
              <InlineConfirm
                question={`Roll back production to ${shortImage(asking)}?`}
                confirm="Roll back"
                busy={rollback.busy}
                onConfirm={() => void doRollback(asking)}
                onCancel={() => setAsking(null)}
              />
            ) : null}
            {images.length > 0 && earlier.length === 0 ? (
              <p className="border-t border-line-soft px-4 py-3 text-[13px] text-ink-muted">No earlier image yet</p>
            ) : null}
          </>
        )}
      </DevCard>

      <DevCard title="Database migrations" meta={q.data?.migrations.state === 'ok' ? (waiting ? `${waiting} waiting` : 'All applied') : undefined}>
        {!q.data ? (
          <Pending error={q.error} />
        ) : q.data.migrations.state === 'ok' ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={migrationColumns} rows={q.data.migrations.data} rowKey={(m) => m.tag} pageSize={10} minWidth={620} stickyFirstColumn />
          </div>
        ) : (
          <ReachNotice reach={q.data.migrations} service="The migrations table" />
        )}
      </DevCard>

      <DevCard title="Feature flags" meta="From the service env">
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={flagColumns} rows={q.data.flags} rowKey={(f) => f.id} minWidth={620} stickyFirstColumn />
          </div>
        ) : (
          <Pending error={q.error} rows={3} />
        )}
      </DevCard>

      <ChangeConfirm
        open={confirm}
        onOpenChange={setConfirm}
        title={`Redeploy ${version} to production?`}
        before={svc ? `${words(svc.status)} · ${svc.image ?? '-'}` : '-'}
        after={`Redeploying · ${svc?.image ?? '-'}`}
        confirm="Redeploy"
        busy={redeploy.busy}
        onConfirm={doRedeploy}
      />
    </div>
  );
}
