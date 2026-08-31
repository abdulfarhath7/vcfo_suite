'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackCluster } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { AccentButton } from '@/components/noir/AccentButton';
import { DashDataTable, type DashColumn } from '@/components/dash/DashDataTable';
import { DashFilterChip } from '@/components/dash/DashFilterChip';
import { TONE_BADGE } from '@/components/common/IconChip';
import {
  attentionReason,
  HEALTH_LABEL,
  HEALTH_TONE,
  idleLabel,
  phaseFill,
  STATE_TONE,
} from '@/components/super/overview/super-overview-format';
import { useSuperOverview } from '@/lib/use-super-overview';
import {
  needsAttention,
  SUPER_PROJECTS_HREF,
  type SuperEngagementSummary,
  type SuperOverview,
} from '@/lib/super-overview';
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
  { id: 'all', label: 'All projects' },
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
          <p className="mt-1 text-sm text-muted-foreground">
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
          <h1 className="sr-only">Projects</h1>
          <span className="text-xs font-bold text-text-tertiary">
            {rows.length} of {overview.engagements.length}{' '}
            {overview.engagements.length === 1 ? 'project' : 'projects'}
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

      <DashDataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        rowHref={(row) => row.href}
        mobile={(row) => <ProjectMobileRow summary={row} />}
        empty="No project matches this filter."
      />
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

const COLUMNS: DashColumn<SuperEngagementSummary>[] = [
  {
    key: 'company',
    header: 'Project',
    width: 'minmax(0,1.5fr)',
    render: (row) => (
      <span className="block min-w-0 truncate text-ink">{row.companyName}</span>
    ),
  },
  {
    key: 'stage',
    header: 'Stage',
    width: 'minmax(0,0.8fr)',
    render: (row) => (
      <span className={cn('inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-extrabold', TONE_BADGE.sky)}>
        {row.stageLabel}
      </span>
    ),
  },
  {
    key: 'progress',
    header: 'Progress',
    width: 'minmax(6rem,0.9fr)',
    render: (row) => <ProgressTrack summary={row} />,
  },
  {
    key: 'state',
    header: 'State',
    width: 'minmax(0,1.1fr)',
    render: (row) => (
      <span
        title={attentionReason(row)}
        className={cn(
          'inline-block max-w-full truncate rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
          TONE_BADGE[STATE_TONE[row.stateKey]],
        )}
      >
        {row.stateLabel}
      </span>
    ),
  },
  {
    key: 'lead',
    header: 'Lead',
    width: 'minmax(0,0.9fr)',
    render: (row) => (
      <span className="block min-w-0 truncate text-muted-foreground">
        {row.leadName ?? 'Unassigned'}
      </span>
    ),
  },
  {
    key: 'health',
    header: 'Health',
    width: 'minmax(4.5rem,0.6fr)',
    render: (row) => (
      <span
        className={cn(
          'inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
          TONE_BADGE[HEALTH_TONE[row.health] ?? 'neutral'],
        )}
      >
        {HEALTH_LABEL[row.health] ?? row.health}
      </span>
    ),
  },
  {
    key: 'idle',
    header: 'Last move',
    width: 'minmax(4.5rem,0.5fr)',
    align: 'right',
    mono: true,
    render: (row) => (
      <span className={cn(row.idleDays !== null && row.idleDays >= 14 && 'text-danger-text')}>
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
            className="relative block overflow-hidden rounded-full bg-raised"
            style={{ flex: Math.max(phase.total, 1) }}
          >
            <i
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${phase.pct}%`, background: phaseFill(phase.id) }}
            />
          </span>
        ))}
      </span>
      <span className="mt-1 block font-mono text-[10.5px] font-semibold text-text-tertiary">
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
        <span className="min-w-0 flex-1 truncate text-[13px] font-extrabold text-ink">
          {summary.companyName}
        </span>
        <span
          className={cn(
            'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold',
            TONE_BADGE[STATE_TONE[summary.stateKey]],
          )}
        >
          {summary.stateLabel}
        </span>
      </div>
      <div className="mt-1.5">
        <ProgressTrack summary={summary} />
      </div>
      <p className="mt-1 min-w-0 truncate text-[11.5px] font-semibold text-muted-foreground">
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
