'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { AccentButton } from '@/components/noir/AccentButton';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { DashFilterChip } from '@/components/dash/DashFilterChip';
import { CHIP_CLASS, CHIP_COLUMN_CLASS, TONE_OWNER, TONE_SOLID } from '@/components/common/IconChip';
import {
  attentionReason,
  HEALTH_LABEL,
  idleLabel,
  phaseFill,
} from '@/components/super/overview/super-overview-format';
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
 * The table is `DashDataTable`, which is the lead dashboard's own list style —
 * same header scale, row height, dividers, hover and chips.
 */

type Filter = 'all' | 'attention' | 'firm' | 'client';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All clients' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'firm', label: 'With the firm' },
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

  const rows = useMemo(() => {
    if (!overview) return [];
    return overview.engagements.filter(
      (summary) => matchesFilter(summary, filter) && (!stage || summary.stage === stage),
    );
  }, [overview, filter, stage]);

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
        <ProjectsSkeleton />
      </PageTransition>
    );
  }

  if (query.isError || !overview) {
    return (
      <PageTransition>
        {seo}
        <div className="surface px-6 py-8 text-center">
          <p className="serif text-lg">The project list could not load</p>
          <p className="mt-1 text-sm text-ink-muted">
            {query.error instanceof Error ? query.error.message : 'Something went wrong.'}
          </p>
          <AccentButton className="mt-4" variant="outline" onClick={() => void query.refetch()}>
            Try again
          </AccentButton>
        </div>
      </PageTransition>
    );
  }

  const counts = countsFor(overview);

  return (
    <PageTransition>
      {seo}

      <div className="mb-3 flex min-w-0 flex-wrap items-center gap-3">
        <PageBackCluster>
          <h1 className="sr-only">Clients</h1>
          <span className="text-xs font-semibold text-ink-faint">
            {rows.length} of {overview.engagements.length}{' '}
            {overview.engagements.length === 1 ? 'client' : 'clients'}
          </span>
        </PageBackCluster>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((entry) => (
          <DashFilterChip
            key={entry.id}
            on={filter === entry.id}
            label={entry.label}
            count={counts[entry.id]}
            onClick={() => go({ filter: entry.id })}
          />
        ))}
        <span className="w-2" />
        {overview.charts.byStage.map((bar) => (
          <DashFilterChip
            key={bar.stage}
            on={stage === bar.stage}
            label={bar.label}
            count={bar.onTrack + bar.attention}
            onClick={() => go({ stage: stage === bar.stage ? null : bar.stage })}
          />
        ))}
      </div>

      <div className="hidden md:block">
        <EFilingGrid
          caption="Clients"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.id}
          onRowClick={(row) => router.push(row.href)}
          empty="No client matches this filter."
          minWidth={860}
        />
      </div>
      <div className="surface divide-y divide-line-soft md:hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-[13px] text-ink-muted">No client matches this filter.</p>
        ) : (
          rows.map((row) => (
            <button key={row.id} type="button" className="block w-full px-4 py-3 text-left" onClick={() => router.push(row.href)}>
              <ProjectMobileRow summary={row} />
            </button>
          ))
        )}
      </div>
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

/* Shared chips (C-0035): a state is a soft dot chip, an owner a soft owner chip. */
const STATE_CHIP: Record<SuperEngagementSummary['stateKey'], string> = {
  complete: TONE_SOLID.done,
  overdue: TONE_SOLID.overdue,
  review: TONE_SOLID.waiting,
  'with-client': TONE_OWNER.client,
  'with-firm': TONE_OWNER.sbc,
};
const HEALTH_CHIP: Record<string, string> = {
  'on-track': TONE_SOLID.done,
  'at-risk': TONE_SOLID.waiting,
  overdue: TONE_SOLID.overdue,
};

/* The clients grid (K-45 style per C-0035 and C-0036): the shared e-Filing grid. */
const COLUMNS: EFilingColumn<SuperEngagementSummary>[] = [
  { key: 'company', header: 'Client', width: '24%', render: (row) => <span className="font-semibold">{row.companyName}</span> },
  { key: 'stage', header: 'Stage', width: '12%', render: (row) => row.stageLabel },
  { key: 'progress', header: 'Progress', width: '17%', render: (row) => <ProgressTrack summary={row} /> },
  {
    key: 'state',
    header: 'State',
    width: '124px',
    render: (row) => (
      <span title={attentionReason(row)} className={cn(CHIP_CLASS, CHIP_COLUMN_CLASS, STATE_CHIP[row.stateKey])}>
        {row.stateLabel}
      </span>
    ),
  },
  { key: 'lead', header: 'Lead', width: '14%', render: (row) => row.leadName ?? 'Unassigned' },
  {
    key: 'health',
    header: 'Health',
    width: '124px',
    render: (row) => (
      <span className={cn(CHIP_CLASS, CHIP_COLUMN_CLASS, HEALTH_CHIP[row.health] ?? TONE_SOLID.upcoming)}>
        {HEALTH_LABEL[row.health] ?? row.health}
      </span>
    ),
  },
  {
    key: 'idle',
    header: 'Last move',
    width: '88px',
    align: 'right',
    render: (row) => (
      <span className={cn('tabular-nums', row.idleDays !== null && row.idleDays >= 14 && 'text-danger')}>
        {row.idleDays === null ? '—' : row.idleDays === 0 ? 'today' : `${row.idleDays}d`}
      </span>
    ),
  },
];

function ProgressTrack({ summary }: { summary: SuperEngagementSummary }) {
  return (
    <span className="block min-w-0">
      <span className="flex h-2 gap-1">
        {summary.phases.map((phase) => (
          <span
            key={phase.id}
            className="relative block overflow-hidden rounded-full bg-surface-sunken"
            style={{ flex: Math.max(phase.total, 1) }}
          >
            <i
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${phase.pct}%`, background: phaseFill(phase.id) }}
            />
          </span>
        ))}
      </span>
      <span className="mt-1 block text-[10.5px] font-semibold text-ink-faint tabular-nums">
        {summary.progress.pct}% · {summary.progress.done}/{summary.progress.total}
      </span>
    </span>
  );
}

function ProjectMobileRow({ summary }: { summary: SuperEngagementSummary }) {
  const idle = idleLabel(summary);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
          {summary.companyName}
        </span>
        <span className={cn('shrink-0', CHIP_CLASS, STATE_CHIP[summary.stateKey])}>
          {summary.stateLabel}
        </span>
      </div>
      <div className="mt-1.5">
        <ProgressTrack summary={summary} />
      </div>
      <p className="mt-1 min-w-0 truncate text-[11.5px] font-semibold text-ink-muted">
        {attentionReason(summary)}
        {summary.leadName ? ` · ${summary.leadName}` : ''}
        {idle ? ` · ${idle}` : ''}
      </p>
    </div>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading projects">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="skeleton-brand h-7 w-28 rounded-full" aria-hidden />
        ))}
      </div>
      <div className="skeleton-brand h-[420px] rounded-[var(--radius)]" aria-hidden />
    </div>
  );
}

export default function SuperProjects() {
  return (
    <Suspense
      fallback={
        <div className="skeleton-brand h-[420px] rounded-[var(--radius)]" aria-hidden />
      }
    >
      <SuperProjectsInner />
    </Suspense>
  );
}
