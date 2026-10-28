"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useInternPortfolio } from '@/hooks/use-intern-portfolio';
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { LeadCompanyChip } from '@/components/intern/LeadCompanyChip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Chip, type ChipTone } from '@/components/ui/spectrum-chip';
import { PhaseBar } from '@/components/ui/step-track';
import { EmptyState } from '@/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { internEngagementPath } from '@/lib/projects/project-step-path';
import { internCompanyPhaseProgress, type InternCompanyPhaseProgress } from '@/lib/intern/intern-work';
import type { Engagement } from '@/data/engagements';

type Row = { e: Engagement; pct: number; progress: InternCompanyPhaseProgress };

/** Lead client status (prototype `clientStatus`): Stuck, Not started, In progress or Done. */
function rowStatus(r: Row): { word: string; tone: ChipTone } {
  if (r.progress.stuck) return { word: 'Stuck', tone: 'bad' };
  const done = r.progress.phases.reduce((n, p) => n + p.done, 0);
  const total = r.progress.phases.reduce((n, p) => n + p.total, 0);
  if (total > 0 && done >= total) return { word: 'Done', tone: 'ok' };
  if (done === 0) return { word: 'Not started', tone: 'idle' };
  return { word: 'In progress', tone: 'prog' };
}

/** Stage is a category, not a status: no dot (prototype grids). */
const STAGE_TONE: Record<string, ChipTone> = {
  'Pre-Incorporation': 'violet',
  'Post-Incorporation': 'prog',
  'Operational Readiness': 'teal',
};

/**
 * Lead Clients (prototype `ClientsScreen` and `ClientsGrid`): a T1 grid of the lead's companies
 * with the stage chip, the ST5 phase bars, where each one is now and its status. Stage tabs
 * sit in the card head. On phones each company is one row card.
 */
export default function InternClients() {
  const { myEngagements, progressByEngagement } = useInternPortfolio();
  const { getStateForEngagement } = useApp();
  const router = useRouter();
  const [stage, setStage] = useState('');

  const all: Row[] = useMemo(
    () =>
      myEngagements.map((e) => ({
        e,
        pct: progressByEngagement.get(e.id) ?? 0,
        progress: internCompanyPhaseProgress(e, getStateForEngagement(e)),
      })),
    [myEngagements, progressByEngagement, getStateForEngagement],
  );
  const stages = useMemo(() => [...new Set(all.map((r) => r.e.stage).filter(Boolean))] as string[], [all]);
  const rows = stage ? all.filter((r) => r.e.stage === stage) : all;

  const columns: EFilingColumn<Row>[] = [
    {
      key: 'name',
      header: 'Client',
      width: '28%',
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <LeadCompanyChip name={r.e.companyName} compact />
          <Link href={internEngagementPath(r.e)} onClick={(ev) => ev.stopPropagation()} className="min-w-0 truncate font-medium text-ink hover:underline" title={r.e.companyName}>
            {r.e.companyName}
          </Link>
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Stage',
      width: '128px',
      render: (r) => (
        <Chip tone={STAGE_TONE[r.e.stage] ?? 'idle'} fixed dot={false}>
          {stageDisplayLabel(r.e.stage) || 'Incorporation'}
        </Chip>
      ),
    },
    {
      key: 'phases',
      header: 'Phases',
      width: '200px',
      render: (r) => (
        <PhaseBar
          done={r.progress.phases.map((p) => p.done)}
          totals={r.progress.phases.map((p) => p.total)}
          names={r.progress.phases.map((p) => p.title)}
          className="w-full"
        />
      ),
    },
    {
      key: 'now',
      header: 'Now',
      render: (r) => <span className="text-ink-2" title={r.progress.currentLabel}>{r.progress.currentLabel || '—'}</span>,
    },
    {
      key: 'pct',
      header: 'Done',
      width: '72px',
      align: 'right',
      render: (r) => <span className="text-[13px] tabular-nums text-ink-muted">{r.pct}%</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: '128px',
      render: (r) => {
        const s = rowStatus(r);
        return (
          <Chip tone={s.tone} fixed>
            {s.word}
          </Chip>
        );
      },
    },
  ];

  const tabs =
    stages.length > 1 ? (
      <SpectrumTabs
        label="Stage"
        items={[
          { key: '', label: 'All', count: all.length },
          ...stages.map((s) => ({ key: s, label: stageDisplayLabel(s), count: all.filter((r) => r.e.stage === s).length })),
        ]}
        value={stage}
        onChange={setStage}
      />
    ) : null;

  return (
    <PageTransition>
      <SEO title="Clients — VCFO Suite" description="Engagements assigned to you and how far each company is through setup." path="/app/intern/clients" />
      <h1 className="sr-only">Clients</h1>

      {myEngagements.length === 0 ? (
        <EmptyState title="No clients assigned yet" />
      ) : (
        <section className="surface min-w-0 overflow-hidden">
          <div className="flex min-h-[52px] min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-line-soft px-4 py-2">
            <CardHeadTile title="Clients" />
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">Clients</h2>
            {tabs}
            <span className="shrink-0 text-[12.5px] tabular-nums text-ink-muted">
              {rows.length === all.length ? all.length : `${rows.length} of ${all.length}`}
            </span>
          </div>
          <div className="hidden px-2 pb-2 md:block">
            <EFilingGrid
              caption="Clients"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.e.id}
              pageSize={14}
              minWidth={760}
              onRowClick={(r) => router.push(internEngagementPath(r.e))}
              empty="Nothing in this view"
            />
          </div>
          <ul className="md:hidden">
            {rows.map((r) => {
              const s = rowStatus(r);
              return (
                <li key={r.e.id} className="border-b border-line-soft last:border-b-0">
                  <Link href={internEngagementPath(r.e)} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-sunken/60">
                    <LeadCompanyChip name={r.e.companyName} compact />
                    <span className="grid min-w-0 flex-1 gap-1.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <b className="min-w-0 truncate font-medium text-ink">{r.e.companyName}</b>
                        <Chip tone={s.tone} className="ml-auto flex-none">
                          {s.word}
                        </Chip>
                      </span>
                      <span className="truncate text-[12.5px] text-ink-muted">{r.progress.currentLabel}</span>
                      <span className="flex items-center gap-2">
                        <PhaseBar
                          done={r.progress.phases.map((p) => p.done)}
                          totals={r.progress.phases.map((p) => p.total)}
                          names={r.progress.phases.map((p) => p.title)}
                          className="flex-1"
                        />
                        <span className="flex-none text-[12px] tabular-nums text-ink-muted">{r.pct}%</span>
                      </span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 flex-none text-ink-faint" strokeWidth={1.6} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PageTransition>
  );
}
