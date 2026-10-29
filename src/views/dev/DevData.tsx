'use client';

import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { CHART_STATUS, DashBarChart } from '@/components/charts';
import { DevCard, KeyValue, Pending, ReachChip, ReachNotice, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { bytes, day, money, stamp } from '@/lib/dev/format';
import type { BucketStat, CostLine, DataExtra, DataPayload, TableStat } from '@/lib/dev/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;

const bucketColumns: EFilingColumn<BucketStat>[] = [
  { key: 'bucket', header: 'Bucket', render: (b) => <span className="font-mono text-[13px] text-ink">{b.bucket}</span> },
  { key: 'region', header: 'Region', width: '120px', render: (b) => <span className="font-mono text-[12.5px]">{b.region ?? '-'}</span> },
  { key: 'size', header: 'Size', width: '110px', align: 'right', render: (b) => `${bytes(b.bytes)}${b.capped ? '+' : ''}` },
  { key: 'objects', header: 'Objects', width: '110px', align: 'right', render: (b) => `${b.objects.toLocaleString('en-IN')}${b.capped ? '+' : ''}` },
  { key: 'ver', header: 'Versioning', width: '148px', render: (b) => <StatusChip status={b.versioning === 'Enabled' ? 'ok' : 'off'} label={b.versioning === 'Enabled' ? 'On' : b.versioning === 'Suspended' ? 'Suspended' : 'Off'} /> },
  { key: 'life', header: 'Lifecycle', width: '110px', render: (b) => (b.lifecycleRules ? `${b.lifecycleRules} rules` : 'None') },
];

/**
 * Data and costs: AWS spend by service for 30 days and by month for six months (Cost
 * Explorer, when AWS_COST_EXPLORER=on), database facts and this month's volumes from the app's
 * own tables, the storage bucket, and table row estimates and sizes for the public schema
 * (Postgres catalog numbers, never rows). Service costs belong here and nowhere else (R-37).
 */
export default function DevData() {
  const q = useDevApi<DataPayload & DataExtra>('/api/dev/data');
  const months = q.data?.months;

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

      <DevCard title="Cost over 6 months" meta={months?.state === 'ok' ? months.data.currency : undefined} right={months ? <ReachChip reach={months} /> : null}>
        {!q.data ? (
          <Pending error={q.error} />
        ) : q.data.months.state === 'ok' ? (
          <div className="px-4 py-4">
            <DashBarChart
              data={q.data.months.data.months.map((m) => ({ month: monthLabel(m.month), amount: Math.round(m.amount * 100) / 100 }))}
              categoryKey="month"
              series={[{ key: 'amount', label: 'Spend', color: CHART_STATUS.active }]}
              valueFormatter={(v) => money(Number(v ?? 0), q.data?.months.state === 'ok' ? q.data.months.data.currency : 'USD')}
              emptyLabel="No spend yet"
            />
          </div>
        ) : (
          <ReachNotice reach={q.data.months} service="Cost Explorer" />
        )}
      </DevCard>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DevCard title="Database" meta="Postgres">
          {q.data ? (
            <KeyValue
              cols={2}
              rows={[
                { k: 'Version', v: q.data.facts.version || '-', mono: true },
                { k: 'Size', v: bytes(q.data.facts.bytes) },
                { k: 'Connections', v: `${q.data.facts.connections} of ${q.data.facts.maxConnections}` },
                { k: 'Running since', v: stamp(q.data.facts.startedAt) },
                { k: 'Oldest vacuum', v: stamp(q.data.facts.oldestVacuum) },
                { k: 'Dead rows', v: q.data.facts.deadRows.toLocaleString('en-IN') },
              ]}
            />
          ) : (
            <Pending error={q.error} rows={3} />
          )}
        </DevCard>
        <DevCard title="Volumes" meta={q.data ? `Since ${day(q.data.volumes.since)}` : undefined}>
          {q.data ? (
            <KeyValue
              cols={2}
              rows={[
                { k: 'Emails sent', v: q.data.volumes.emails.toLocaleString('en-IN') },
                { k: 'WhatsApp sent', v: q.data.volumes.whatsapp.toLocaleString('en-IN') },
                { k: 'Documents added', v: `${q.data.volumes.documents.toLocaleString('en-IN')} · ${bytes(q.data.volumes.documentBytes)}` },
                { k: 'Sign-ins', v: q.data.volumes.signIns.toLocaleString('en-IN') },
                { k: 'Audit events', v: q.data.volumes.auditEvents.toLocaleString('en-IN') },
              ]}
            />
          ) : (
            <Pending error={q.error} rows={3} />
          )}
        </DevCard>
      </div>

      <DevCard title="Storage by bucket" right={q.data ? <ReachChip reach={q.data.bucket} /> : null}>
        {!q.data ? (
          <Pending error={q.error} rows={2} />
        ) : q.data.bucket.state === 'ok' ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={bucketColumns} rows={[q.data.bucket.data]} rowKey={(b) => b.bucket} minWidth={720} stickyFirstColumn />
          </div>
        ) : (
          <ReachNotice reach={q.data.bucket} service="File storage" />
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
