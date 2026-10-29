'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { DashSection } from '@/components/dash/DashSection';
import { Button } from '@/components/ui/button';
import { AssignClientDialog } from '@/components/super/assign/AssignClientDialog';
import { useSuperStaff } from '@/components/super/assign/use-super-staff';
import { AreaPill, Chip } from '@/components/ui/spectrum-chip';
import { PhaseBar } from '@/components/ui/step-track';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import {
  attentionReason,
  HEALTH_LABEL,
  idleLabel,
  superPhaseTrack,
  superStateChip,
} from '@/components/super/overview/super-overview-format';
import {
  ClientTile,
  NameCell,
  PersonAvatar,
  SuperFilterChips,
  SuperPageError,
  SuperPageSkeleton,
} from '@/components/super/parts/super-parts';
import { plainDay, shortCompany, todayKey } from '@/components/super/parts/super-text';
import { useSuperOverview } from '@/hooks/use-super-overview';
import {
  needsAttention,
  SUPER_PROJECTS_HREF,
  type SuperEngagementSummary,
  type SuperOverview,
} from '@/lib/super/super-overview';
import { cn } from '@/lib/utils';

/**
 * SUPER ADMIN PROJECTS (L1) — every engagement in the firm, one row each.
 *
 * Reads the same scoped aggregate as the Overview, so the list and the
 * dashboard can never disagree; filtering is client-side over rows the server
 * already ranked by urgency. Read-only, like the rest of this surface.
 *
 * The table is the shared `EFilingGrid` (Spectrum T1 rows). The state switch and
 * the stage chip live in the URL (`?filter=`, `?stage=`), so the Overview's
 * links keep landing on the right slice; admin, manager and lead chips are local.
 * The Admin column reads the manager's reporting line (G-20), and "Assign client"
 * opens the same assign dialog as the Overview.
 */

type Filter = 'all' | 'attention' | 'firm' | 'client';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'firm', label: 'With SBC' },
  { id: 'client', label: 'With the client' },
];

function parseFilter(value: string | null): Filter {
  return value === 'attention' || value === 'firm' || value === 'client' ? value : 'all';
}

function matchesFilter(summary: SuperEngagementSummary, filter: Filter): boolean {
  if (filter === 'attention') return needsAttention(summary);
  if (filter === 'firm') return summary.currentStep?.owner === 'firm';
  if (filter === 'client') return summary.currentStep?.owner === 'client';
  return true;
}

function SuperProjectsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const query = useSuperOverview();
  const overview = query.data;

  const filter = parseFilter(params.get('filter'));
  const stage = params.get('stage');
  const [admin, setAdmin] = useState('');
  const [manager, setManager] = useState('');
  const [lead, setLead] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const staff = useSuperStaff();
  const adminOf = staff.adminNameOf;

  const rows = useMemo(() => {
    if (!overview) return [];
    return overview.engagements.filter(
      (summary) =>
        matchesFilter(summary, filter) &&
        (!stage || summary.stage === stage) &&
        (!admin || (adminOf(summary.managerId) ?? 'Unassigned') === admin) &&
        (!manager || (summary.managerName ?? 'Unassigned') === manager) &&
        (!lead || (summary.leadName ?? 'Unassigned') === lead),
    );
  }, [overview, filter, stage, admin, manager, lead, adminOf]);

  /** Earliest open filing per engagement, from the overview's 90-day filing window. */
  const nextDue = useMemo(() => {
    const out = new Map<string, string>();
    for (const filing of overview?.filings ?? []) {
      if (filing.status === 'filed') continue;
      const current = out.get(filing.engagementId);
      if (!current || filing.dueDate < current) out.set(filing.engagementId, filing.dueDate);
    }
    return out;
  }, [overview]);

  const go = (next: { filter?: Filter; stage?: string | null }) => {
    const search = new URLSearchParams();
    const nextFilter = next.filter ?? filter;
    const nextStage = next.stage === undefined ? stage : next.stage;
    if (nextFilter !== 'all') search.set('filter', nextFilter);
    if (nextStage) search.set('stage', nextStage);
    const qs = search.toString();
    router.replace(qs ? `${SUPER_PROJECTS_HREF}?${qs}` : SUPER_PROJECTS_HREF, { scroll: false });
  };

  const seo = (
    <SEO
      title="Projects — VCFO Suite"
      description="Every engagement in the firm, ranked by what needs a human."
      path={SUPER_PROJECTS_HREF}
    />
  );

  if (query.isPending) {
    return (
      <PageTransition>
        {seo}
        <SuperPageSkeleton label="Loading clients" />
      </PageTransition>
    );
  }

  if (query.isError || !overview) {
    return (
      <PageTransition>
        {seo}
        <SuperPageError title="The client list could not load" error={query.error} onRetry={() => void query.refetch()} />
      </PageTransition>
    );
  }

  const counts = countsFor(overview);
  const names = (pick: (s: SuperEngagementSummary) => string | null) =>
    [...new Set(overview.engagements.map((s) => pick(s) ?? 'Unassigned'))].sort((a, b) => a.localeCompare(b));
  const stageLabel = overview.charts.byStage.find((bar) => bar.stage === stage)?.label ?? '';
  const columns = columnsFor(nextDue, adminOf);
  const adminNames = [...new Set(overview.engagements.map((s) => adminOf(s.managerId) ?? 'Unassigned'))].sort((a, b) =>
    a.localeCompare(b),
  );

  return (
    <PageTransition>
      {seo}

      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3">
        <PageBackCluster>
          <h1 className="text-[22px] font-medium leading-tight tracking-[-0.01em] text-ink">Clients</h1>
          <span className="text-[13px] text-ink-muted">
            {rows.length} of {overview.engagements.length}
          </span>
        </PageBackCluster>
        <Button className="ml-auto" onClick={() => setAssignOpen(true)}>
          <UserPlus aria-hidden />
          Assign client
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SpectrumTabs
          label="Show"
          size="md"
          items={FILTERS.map((entry) => ({ key: entry.id, label: entry.label, count: counts[entry.id] }))}
          value={filter}
          onChange={(key) => go({ filter: parseFilter(key) })}
        />
        <SuperFilterChips
          onClear={() => {
            setAdmin('');
            setManager('');
            setLead('');
            go({ stage: null });
          }}
          filters={[
            { key: 'admin', label: 'Admin', value: admin, options: adminNames, onChange: setAdmin },
            { key: 'manager', label: 'Manager', value: manager, options: names((s) => s.managerName), onChange: setManager },
            { key: 'lead', label: 'Lead', value: lead, options: names((s) => s.leadName), onChange: setLead },
            {
              key: 'stage',
              label: 'Stage',
              value: stageLabel,
              options: overview.charts.byStage.map((bar) => bar.label),
              onChange: (label) =>
                go({ stage: overview.charts.byStage.find((bar) => bar.label === label)?.stage ?? null }),
            },
          ]}
        />
      </div>

      <DashSection title="All clients" meta={`${rows.length} of ${overview.engagements.length}`} bodyClassName="px-2 pb-2 pt-1">
        <div className="hidden md:block">
          <EFilingGrid
            caption="Clients"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={(row) => router.push(row.href)}
            empty="No client matches these filters"
            minWidth={1180}
            pageSize={17}
          />
        </div>
        <div className="divide-y divide-line-soft md:hidden">
          {rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-ink-muted">No client matches these filters</p>
          ) : (
            rows.map((row) => (
              <button key={row.id} type="button" className="block w-full px-2 py-3 text-left" onClick={() => router.push(row.href)}>
                <ProjectMobileRow summary={row} />
              </button>
            ))
          )}
        </div>
      </DashSection>

      <AssignClientDialog open={assignOpen} onOpenChange={setAssignOpen} engagements={overview.engagements} staff={staff} />
    </PageTransition>
  );
}

function countsFor(overview: SuperOverview): Record<Filter, number> {
  return {
    all: overview.engagements.length,
    attention: overview.engagements.filter(needsAttention).length,
    firm: overview.engagements.filter((row) => row.currentStep?.owner === 'firm').length,
    client: overview.engagements.filter((row) => row.currentStep?.owner === 'client').length,
  };
}

const HEALTH_TONE: Record<string, 'ok' | 'bad' | 'warn'> = {
  'on-track': 'ok',
  'at-risk': 'warn',
  overdue: 'bad',
};

/* The clients grid (K-45, C-0109): Spectrum T1 rows with the ST5 phase bars, the area pill
   for the stage and the status chip in one of the six words. */
function columnsFor(
  nextDue: Map<string, string>,
  adminOf: (managerId: string | null) => string | null,
): EFilingColumn<SuperEngagementSummary>[] {
  const today = todayKey();
  return [
    {
      key: 'company',
      header: 'Client',
      width: '19%',
      render: (row) => (
        <NameCell lead={<ClientTile id={row.id} name={row.companyName} />} title={shortCompany(row.companyName)} />
      ),
    },
    {
      key: 'now',
      header: 'Now at',
      width: '20%',
      render: (row) => (
        <NameCell title={row.currentStep?.title ?? 'Every step is done'} sub={row.leadName ?? 'No lead'} />
      ),
    },
    { key: 'progress', header: 'Progress', width: '150px', render: (row) => <ProgressTrack summary={row} /> },
    {
      key: 'manager',
      header: 'Manager',
      width: '14%',
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          <PersonAvatar name={row.managerName ?? '?'} />
          <span className="min-w-0 truncate">{row.managerName ?? 'Unassigned'}</span>
        </span>
      ),
    },
    {
      key: 'admin',
      header: 'Admin',
      width: '11%',
      render: (row) => {
        const name = adminOf(row.managerId);
        return name ? <span className="block min-w-0 truncate">{name}</span> : <span className="text-ink-faint">–</span>;
      },
    },
    {
      key: 'stage',
      header: 'Stage',
      width: '124px',
      render: (row) => <AreaPill area={row.stageLabel} reg={row.incorporated ? undefined : 'mca'} />,
    },
    {
      key: 'next',
      header: 'Next',
      width: '68px',
      render: (row) => {
        const due = nextDue.get(row.id) ?? null;
        return <span className={cn('tabular-nums', due && due < today && 'font-medium text-danger')}>{plainDay(due)}</span>;
      },
    },
    {
      key: 'state',
      header: 'State',
      width: '120px',
      render: (row) => {
        const chip = superStateChip(row);
        return (
          <Chip fixed tone={chip.tone} title={`${chip.title} · ${attentionReason(row)}`}>
            {chip.word}
          </Chip>
        );
      },
    },
    {
      key: 'health',
      header: 'Health',
      width: '120px',
      render: (row) => (
        <Chip fixed tone={HEALTH_TONE[row.health] ?? 'idle'}>
          {HEALTH_LABEL[row.health] ?? row.health}
        </Chip>
      ),
    },
    {
      key: 'idle',
      header: 'Last move',
      width: '88px',
      align: 'right',
      render: (row) => (
        <span className={cn('tabular-nums', row.idleDays !== null && row.idleDays >= 14 && 'font-medium text-danger')}>
          {row.idleDays === null ? '–' : row.idleDays === 0 ? 'Today' : `${row.idleDays}d`}
        </span>
      ),
    },
  ];
}

function ProgressTrack({ summary }: { summary: SuperEngagementSummary }) {
  const track = superPhaseTrack(summary);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PhaseBar done={track.done} totals={track.totals} names={track.names} className="w-24" />
      <span className="text-[12.5px] tabular-nums text-ink-muted">{summary.progress.pct}%</span>
    </span>
  );
}

function ProjectMobileRow({ summary }: { summary: SuperEngagementSummary }) {
  const idle = idleLabel(summary);
  const chip = superStateChip(summary);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <ClientTile id={summary.id} name={summary.companyName} />
        <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{summary.companyName}</span>
        <Chip fixed tone={chip.tone} title={chip.title} className="shrink-0">
          {chip.word}
        </Chip>
      </div>
      <div className="mt-2">
        <ProgressTrack summary={summary} />
      </div>
      <p className="mt-1 min-w-0 truncate text-[12.5px] text-ink-muted">
        {attentionReason(summary)}
        {summary.leadName ? ` · ${summary.leadName}` : ''}
        {idle ? ` · ${idle}` : ''}
      </p>
    </div>
  );
}

export default function SuperProjects() {
  return (
    <Suspense
      fallback={<SuperPageSkeleton label="Loading clients" />}
    >
      <SuperProjectsInner />
    </Suspense>
  );
}
