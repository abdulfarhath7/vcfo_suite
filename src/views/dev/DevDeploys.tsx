'use client';

import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Button } from '@/components/ui/button';
import { ChangeConfirm, DevCard, KeyValue, Pending, ReachChip, ReachNotice, StatusChip, useDevAction } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { duration, imageVersion, stamp, words } from '@/lib/dev/format';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { DeployOperation, DeploysPayload } from '@/lib/dev/types';

/**
 * Deploys: the App Runner service (DescribeService) and its recent operations
 * (ListOperations) for APP_RUNNER_SERVICE_ARN. "Redeploy" (R-40, a change confirm) rolls out
 * the image the service already names through `POST /api/dev/deploys/redeploy`, which writes
 * the audit row. A new version or a roll back still goes through the pipeline, because App
 * Runner keeps no list of earlier images.
 */
export default function DevDeploys() {
  const q = useDevApi<DeploysPayload>('/api/dev/deploys', { refetchMs: 60_000 });
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
            />
          </div>
        ) : (
          <ReachNotice reach={q.data.operations} service="App Runner" />
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
