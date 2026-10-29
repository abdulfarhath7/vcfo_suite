'use client';

import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { DevCard, Pending, ReachChip, ReachNotice } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { bytes, day, money } from '@/lib/dev/format';
import type { CostLine, DataPayload, TableStat } from '@/lib/dev/types';

/**
 * Data and costs: table row estimates and sizes for the public schema (Postgres catalog
 * numbers, never rows), and AWS spend by service for the last 30 days from Cost Explorer
 * when AWS_COST_EXPLORER=on. Service costs belong here and nowhere else (R-37).
 */
export default function DevData() {
  const q = useDevApi<DataPayload>('/api/dev/data');

  const tableColumns: EFilingColumn<TableStat>[] = [
    { key: 'name', header: 'Table', render: (t) => <span className="font-mono text-[13px] font-medium text-ink">{t.name}</span> },
    { key: 'rows', header: 'Rows, about', width: '140px', align: 'right', render: (t) => t.rows.toLocaleString('en-IN') },
    { key: 'size', header: 'Size', width: '120px', align: 'right', render: (t) => bytes(t.bytes) },
  ];

  const costs = q.data?.costs;
  const costColumns: EFilingColumn<CostLine>[] = [
    { key: 'service', header: 'Service', render: (c) => <span className="font-medium text-ink">{c.service}</span> },
    {
      key: 'amount',
      header: 'Last 30 days',
      width: '150px',
      align: 'right',
      render: (c) => (costs?.state === 'ok' ? money(c.amount, costs.data.currency) : '-'),
    },
    {
      key: 'share',
      header: 'Share',
      width: '90px',
      align: 'right',
      render: (c) => (costs?.state === 'ok' && costs.data.total > 0 ? `${Math.round((c.amount / costs.data.total) * 100)}%` : '-'),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DevCard
        title="Costs by service"
        meta={costs?.state === 'ok' ? `${day(costs.data.start)} to ${day(costs.data.end)} · ${money(costs.data.total, costs.data.currency)}` : undefined}
        right={costs ? <ReachChip reach={costs} /> : null}
      >
        {!q.data ? (
          <Pending error={q.error} />
        ) : q.data.costs.state === 'ok' ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={costColumns} rows={q.data.costs.data.services} rowKey={(c) => c.service} pageSize={20} minWidth={480} empty="No spend in this period" />
          </div>
        ) : (
          <ReachNotice reach={q.data.costs} service="Cost Explorer" />
        )}
      </DevCard>

      <DevCard title="Database tables" meta={q.data ? `Postgres · ${bytes(q.data.database.bytes)} in all` : undefined}>
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={tableColumns} rows={q.data.database.tables} rowKey={(t) => t.name} pageSize={25} minWidth={480} />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>
    </div>
  );
}
