'use client';

import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { DevCard, KeyValue, Pending, ReachChip, ReachNotice, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { duration, stamp, words } from '@/lib/dev/format';
import type { DeployOperation, DeploysPayload } from '@/lib/dev/types';

/**
 * Deploys: the App Runner service (DescribeService) and its recent operations
 * (ListOperations) for APP_RUNNER_SERVICE_ARN. Read only: a deploy or roll back is done from
 * the pipeline, not from this page.
 */
export default function DevDeploys() {
  const q = useDevApi<DeploysPayload>('/api/dev/deploys', { refetchMs: 60_000 });

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
      <DevCard title="Production service" meta="App Runner" right={q.data ? <ReachChip reach={q.data.service} /> : null}>
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
            <EFilingGrid columns={columns} rows={q.data.operations.data} rowKey={(o) => o.id} pageSize={20} minWidth={820} empty="No operations yet" />
          </div>
        ) : (
          <ReachNotice reach={q.data.operations} service="App Runner" />
        )}
      </DevCard>
    </div>
  );
}
