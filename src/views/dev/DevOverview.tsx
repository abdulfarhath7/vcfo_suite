'use client';

import { DashHero, type DashHeroStat } from '@/components/dash/DashHero';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { Chip } from '@/components/ui/spectrum-chip';
import { EmptyState } from '@/components/ui/empty-state';
import { DevCard, EnvNames, ListRow, Pending, ReachChip, ReachNotice, StatusChip } from '@/components/dev/parts';
import { useDevApi } from '@/components/dev/use-dev-api';
import { stamp, words } from '@/lib/dev/format';
import type { JobRun, OverviewPayload, ServiceConfig } from '@/lib/dev/types';

type Attention = { id: string; title: string; sub: string; chip: string; status: string; href: string };

/** Things a developer should act on, worst first. Built only from the real readings. */
function attention(d: OverviewPayload): Attention[] {
  const rows: Attention[] = [];
  if (d.jobs.state === 'ok' && d.jobs.data.failedToday > 0)
    rows.push({ id: 'jobs', title: `${d.jobs.data.failedToday} job runs failed today`, sub: 'Inngest', chip: 'Failed', status: 'failed', href: '/app/dev/jobs' });
  if (d.messages.failed > 0)
    rows.push({ id: 'msg', title: `${d.messages.failed} messages failed in 24 hours`, sub: 'Email and WhatsApp', chip: 'Failed', status: 'failed', href: '/app/dev/messages' });
  if (d.audit7d.denied > 0)
    rows.push({ id: 'denied', title: `${d.audit7d.denied} denied actions in 7 days`, sub: 'Audit', chip: 'Denied', status: 'denied', href: '/app/dev/audit' });
  for (const s of d.services.filter((x) => x.status === 'partial'))
    rows.push({ id: `svc-${s.id}`, title: `${s.name} is partly set`, sub: `Missing ${s.missing.join(', ')}`, chip: 'Partly set', status: 'partial', href: '/app/dev/connections' });
  const creds = d.services.find((s) => s.id === 'credentials');
  if (creds && creds.status !== 'configured')
    rows.push({ id: 'creds', title: 'Portal credentials key is not set', sub: 'Credential features fail until CREDENTIALS_ENCRYPTION_KEY is set', chip: 'Missing', status: 'failed', href: '/app/dev/connections' });
  if (d.outlook.expiringSoon > 0)
    rows.push({ id: 'outlook', title: `${d.outlook.expiringSoon} Outlook mailboxes need sign-in soon`, sub: 'Refresh token near its 90 days', chip: 'Due soon', status: 'due soon', href: '/app/dev/connections' });
  return rows;
}

const serviceColumns: EFilingColumn<ServiceConfig>[] = [
  {
    key: 'name',
    header: 'Service',
    width: '30%',
    render: (s) => (
      <span className="block min-w-0 truncate">
        <span className="font-medium text-ink">{s.name}</span>
        <span className="ml-2 text-[12.5px] text-ink-muted">{s.provider}</span>
      </span>
    ),
  },
  { key: 'status', header: 'Status', width: '148px', render: (s) => <StatusChip status={s.status} /> },
  { key: 'what', header: 'Does', width: '28%', render: (s) => <span className="text-[13px]">{s.what}</span> },
  { key: 'missing', header: 'Missing', wrap: true, render: (s) => <EnvNames names={s.missing} tone={s.status === 'partial' ? 'danger' : 'muted'} /> },
];

const runColumns: EFilingColumn<JobRun>[] = [
  { key: 'fn', header: 'Job', render: (r) => <span className="font-mono text-[13px]">{r.functionId ?? r.event}</span> },
  { key: 'at', header: 'Started', width: '150px', render: (r) => stamp(r.startedAt) },
  { key: 'status', header: 'Status', width: '148px', render: (r) => <StatusChip status={r.status} /> },
];

export default function DevOverview() {
  const q = useDevApi<OverviewPayload>('/api/dev/overview', { refetchMs: 60_000 });
  const d = q.data;

  const working = d ? d.services.filter((s) => s.status === 'configured').length : 0;
  const stats: DashHeroStat[] = d
    ? [
        { label: 'Services working', value: `${working} / ${d.services.length}`, href: '/app/dev/connections' },
        { label: 'Outlook mailboxes', value: d.outlook.connected, sub: d.outlook.expiringSoon ? `${d.outlook.expiringSoon} due soon` : undefined, href: '/app/dev/connections' },
        {
          label: 'Jobs failed today',
          value: d.jobs.state === 'ok' ? d.jobs.data.failedToday : '-',
          hot: d.jobs.state === 'ok' && d.jobs.data.failedToday > 0,
          sub: d.jobs.state === 'not_set_up' ? 'Not set up' : d.jobs.state === 'unreachable' ? 'Unreachable' : undefined,
          href: '/app/dev/jobs',
        },
        { label: 'Messages failed, 24 hours', value: d.messages.failed, hot: d.messages.failed > 0, sub: `${d.messages.sent} sent`, href: '/app/dev/messages' },
        { label: 'Denied, 7 days', value: d.audit7d.denied, hot: d.audit7d.denied > 0, sub: `${d.audit7d.failed} failed`, href: '/app/dev/audit' },
        { label: 'Staff signed in', value: d.staffSignedIn, href: '/app/dev/access' },
      ]
    : [];

  const rows = d ? attention(d) : [];

  return (
    <div className="grid grid-cols-1 gap-5">
      <DashHero
        title="Developer console"
        meta={d && d.deploy.state === 'ok' ? <Chip tone={d.deploy.data.status === 'RUNNING' ? 'ok' : 'warn'}>{words(d.deploy.data.status)}</Chip> : null}
        stats={stats}
      />
      {!d ? (
        <DevCard title="Services health">
          <Pending error={q.error} />
        </DevCard>
      ) : (
        <>
          <DevCard title="Services health" meta={`${working} of ${d.services.length} working`}>
            <div className="px-2 pb-2">
              <EFilingGrid columns={serviceColumns} rows={d.services} rowKey={(s) => s.id} pageSize={20} minWidth={720} caption="Services" />
            </div>
          </DevCard>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <DevCard title="Needs attention" meta={rows.length ? `${rows.length}` : undefined}>
              {rows.length ? (
                rows.map((r) => (
                  <ListRow key={r.id} href={r.href}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">{r.title}</span>
                      <span className="block truncate text-[12.5px] text-ink-muted">{r.sub}</span>
                    </span>
                    <StatusChip status={r.status} label={r.chip} />
                  </ListRow>
                ))
              ) : (
                <div className="p-4">
                  <EmptyState title="Nothing needs attention" />
                </div>
              )}
            </DevCard>
            <DevCard title="Recent job runs" right={<ReachChip reach={d.jobs} />}>
              {d.jobs.state === 'ok' ? (
                <div className="px-2 pb-2">
                  <EFilingGrid columns={runColumns} rows={d.jobs.data.lastRuns} rowKey={(r) => r.id} minWidth={420} empty="No runs today" />
                </div>
              ) : (
                <ReachNotice reach={d.jobs} service="Inngest" />
              )}
            </DevCard>
          </div>
          <DevCard title="Latest deploy" right={<ReachChip reach={d.deploy} />}>
            {d.deploy.state === 'ok' ? (
              d.deploy.data.latest ? (
                <ListRow href="/app/dev/deploys">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{words(d.deploy.data.latest.type)}</span>
                    <span className="block truncate text-[12.5px] text-ink-muted">{stamp(d.deploy.data.latest.startedAt)}</span>
                  </span>
                  <StatusChip status={d.deploy.data.latest.status} />
                </ListRow>
              ) : (
                <div className="p-4">
                  <EmptyState title="No operations yet" />
                </div>
              )
            ) : (
              <ReachNotice reach={d.deploy} service="App Runner" />
            )}
          </DevCard>
        </>
      )}
    </div>
  );
}
