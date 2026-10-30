'use client';

import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { CHART_STATUS, DashBarChart } from '@/components/charts';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/spectrum-chip';
import { ChangeConfirm as ChangeRow } from '@/components/ui/inline-confirm';
import { DevCard, KeyValue, Pending, ReachChip, ReachNotice, StatusChip, useDevAction } from '@/components/dev/parts';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { useDevApi } from '@/components/dev/use-dev-api';
import { bytes, day, money, stamp } from '@/lib/dev/format';
import type { BucketStat, CostLine, DataExtra, DataPayload, ExportRow, SnapshotRow, TableStat } from '@/lib/dev/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => MONTHS[Number(ym.slice(5, 7)) - 1] ?? ym;

const snapshotColumns: EFilingColumn<SnapshotRow>[] = [
  { key: 'id', header: 'Snapshot', render: (x) => <span className="font-mono text-[12.5px] text-ink">{x.id}</span> },
  { key: 'at', header: 'Taken', width: '140px', render: (x) => stamp(x.takenAt) },
  { key: 'kind', header: 'Kind', width: '120px', render: (x) => <Tag tone={x.kind === 'manual' ? 'prog' : 'idle'}>{x.kind === 'manual' ? 'Manual' : 'Automated'}</Tag> },
  { key: 'size', header: 'Size', width: '90px', align: 'right', render: (x) => (x.sizeGiB === null ? '-' : `${x.sizeGiB} GB`) },
  { key: 'status', header: 'Status', width: '148px', render: (x) => <StatusChip status={x.status === 'available' ? 'ok' : x.status === 'creating' ? 'running' : x.status} label={x.status.charAt(0).toUpperCase() + x.status.slice(1)} /> },
];

const KIND_WORD: Record<string, string> = {
  audit_log: 'Audit log',
  vault_zip: 'Vault files',
  client_vault_zip: 'Client vault files',
  partner_report: 'Partner report',
  client_audit: 'Client audit log',
};

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
  const snap = useDevAction<Record<string, never>>('/api/dev/data/snapshot');
  const dl = useDevAction<{ id: string }>('/api/dev/exports/download');
  const [asking, setAsking] = useState(false);
  const [downloaded, setDownloaded] = useState<Set<string>>(() => new Set());
  const backups = q.data?.backups;

  const doSnapshot = async () => {
    const out = await snap.run({});
    if (out.ok === false) {
      toastError('Snapshot not started', out.error);
      return;
    }
    setAsking(false);
    toastSuccess('Snapshot started', String(out.data.id ?? ''));
  };

  const doDownload = async (x: ExportRow) => {
    const out = await dl.run({ id: x.id });
    if (out.ok === false) {
      toastError('Download refused', out.error);
      return;
    }
    window.open(String(out.data.url), '_blank', 'noopener');
    setDownloaded((d) => new Set(d).add(x.id));
  };

  const exportColumns: EFilingColumn<ExportRow>[] = [
    {
      key: 'what',
      header: 'Export',
      render: (x) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium text-ink">{KIND_WORD[x.kind] ?? x.kind}</span>
          <span className="block truncate font-mono text-[12px] text-ink-muted">{x.fileName}</span>
        </span>
      ),
    },
    { key: 'fmt', header: 'Format', width: '90px', render: (x) => <Tag className="font-mono uppercase">{x.format}</Tag> },
    { key: 'size', header: 'Size', width: '90px', align: 'right', render: (x) => bytes(x.sizeBytes) },
    { key: 'by', header: 'Made by', width: '140px', render: (x) => x.madeBy },
    { key: 'when', header: 'When', width: '140px', render: (x) => stamp(x.createdAt) },
    {
      key: 'act',
      header: '',
      width: '130px',
      align: 'right',
      render: (x) =>
        downloaded.has(x.id) ? (
          <span className="text-[13px] text-ink-muted">Downloaded</span>
        ) : x.canDownload ? (
          <Button size="sm" variant="secondary" disabled={dl.busy} onClick={() => void doDownload(x)}>
            Download
          </Button>
        ) : (
          <span className="text-[12.5px] text-ink-faint">{x.kept ? 'Maker only' : 'Not kept'}</span>
        ),
    },
  ];

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

      <DevCard
        title="Backups"
        meta={backups?.state === 'ok' ? `Daily ${backups.data.backupWindow ?? '-'} UTC · kept ${backups.data.retentionDays ?? '-'} days` : undefined}
        right={
          backups?.state === 'ok' ? (
            <Button size="sm" onClick={() => setAsking(true)} disabled={snap.busy}>
              Take snapshot now
            </Button>
          ) : backups ? (
            <ReachChip reach={backups} />
          ) : null
        }
      >
        {!q.data ? (
          <Pending error={q.error} rows={3} />
        ) : q.data.backups.state === 'ok' ? (
          <>
            <KeyValue
              cols={4}
              rows={[
                { k: 'Instance', v: q.data.backups.data.instance, mono: true },
                { k: 'Engine', v: q.data.backups.data.engine || '-' },
                { k: 'Class', v: q.data.backups.data.instanceClass ?? '-', mono: true },
                { k: 'Restorable to', v: stamp(q.data.backups.data.latestRestorable) },
              ]}
            />
            {asking ? (
              <ChangeRow
                question="Take a manual snapshot of production now?"
                now={`${q.data.backups.data.snapshots.length} snapshots`}
                after={`${q.data.backups.data.snapshots.length + 1} snapshots`}
                confirm="Take snapshot"
                busy={snap.busy}
                onConfirm={() => void doSnapshot()}
                onCancel={() => setAsking(false)}
              />
            ) : null}
            <div className="px-2 pb-2">
              <EFilingGrid columns={snapshotColumns} rows={q.data.backups.data.snapshots} rowKey={(x) => x.id} pageSize={10} minWidth={720} empty="No snapshots" stickyFirstColumn />
            </div>
            <p className="border-t border-line-soft px-4 py-3 text-[13px] text-ink-muted">
              Restores follow the runbook in <code className="font-mono text-[12.5px] text-ink-2">docs/context/AWS-DEPLOY.md</code>.
            </p>
          </>
        ) : (
          <ReachNotice reach={q.data.backups} service="RDS backups" />
        )}
      </DevCard>

      <DevCard title="Exports" meta="Kept 30 days">
        {q.data ? (
          <div className="px-2 pb-2">
            <EFilingGrid columns={exportColumns} rows={q.data.exports} rowKey={(x) => x.id} pageSize={20} minWidth={820} empty="No exports in 30 days" stickyFirstColumn />
          </div>
        ) : (
          <Pending error={q.error} />
        )}
      </DevCard>

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
