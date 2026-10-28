'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Eyebrow } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { Chip, Tag } from '@/components/ui/spectrum-chip';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { PhaseBar } from '@/components/ui/step-track';
import { DashSection } from '@/components/dash/DashSection';
import { WorkFilterChip } from '@/components/intern/WorkFilterChip';
import { CompanyTile } from '@/components/staff/today/today-parts';
import { cn } from '@/lib/utils';
import { ProjectActionsMenu } from '@/components/admin/ProjectActionsMenu';
import { deriveStuckReason, STUCK_LABEL, type StuckReason } from '@/lib/projects/project-stuck';
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import { adminProjectPath } from '@/lib/projects/project-step-path';
import { EFilingGrid, type EFilingColumn } from '@/components/dash/EFilingGrid';
import { internCompanyPhaseProgress } from '@/lib/intern/intern-work';
import { sep } from '@/lib/date-format';
import type { EngagementSchedule } from '@/lib/projects/schedule-windows';

/** The earliest window end that is still ahead (or the latest one if all have passed). */
function nextScheduleDate(schedule: EngagementSchedule | null | undefined, todayIso: string): string | null {
  const ends = [schedule?.incorporation?.to, ...Object.values(schedule?.steps ?? {}).map((w) => w?.to)].filter(
    (d): d is string => Boolean(d),
  );
  if (ends.length === 0) return null;
  const ahead = ends.filter((d) => d >= todayIso).sort();
  return ahead[0] ?? ends.sort().at(-1) ?? null;
}
function shortDate(iso: string): string {
  return sep(new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));
}

type ManagerOption = { id: string; name: string; email: string };

async function fetchManagers(): Promise<ManagerOption[]> {
  const res = await fetch('/api/admin/managers');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body.managers ?? []) as ManagerOption[];
}

type PhaseFilter = 'all' | 'Pre-Incorporation' | 'Post-Incorporation';
const STUCK_FILTERS = ['waiting_client', 'waiting_manager', 'waiting_lead', 'blocked', 'on_track'] as const;
const HEALTH_RANK = { overdue: 0, 'at-risk': 1, 'on-track': 2 } as const;

/**
 * Firm-wide project list (admin Today "Clients · where each one is", and the Projects page).
 * A segmented phase switch and R-10 chips for status and manager filter it. Each row shows the
 * company, where it is now, the ST5 phase track (R-22), the manager, the stage, the next date
 * and the health chip; worst health first.
 */
export function FirmProjectsPanel({ compact, title }: { compact?: boolean; title?: string }) {
  const { engagements, getStateForEngagement } = useApp();
  const router = useRouter();
  const [phase, setPhase] = useState<PhaseFilter>('all');
  const [stuck, setStuck] = useState<StuckReason | ''>('');
  const [manager, setManager] = useState('');

  const managersQuery = useQuery({
    queryKey: ['admin-managers'],
    queryFn: fetchManagers,
    staleTime: 5 * 60_000,
  });
  const managerName = (id: string | undefined | null) => {
    if (!id) return 'Unassigned';
    return managersQuery.data?.find((m) => m.id === id)?.name ?? 'Project manager';
  };

  const rows = useMemo(() => {
    return engagements
      .filter((e) => e.stage !== 'Operational Readiness')
      .filter((e) => (phase === 'all' ? true : e.stage === phase))
      .filter((e) => (!manager ? true : (e.managerId ?? e.adminId ?? 'unassigned') === manager))
      .map((e) => {
        const state = getStateForEngagement(e);
        const progress = internCompanyPhaseProgress(e, state);
        const done = progress.phases.reduce((n, p) => n + p.done, 0);
        const total = progress.phases.reduce((n, p) => n + p.total, 0);
        return {
          eng: e,
          reason: deriveStuckReason(e, state),
          step: progress.currentLabel.split(' · ').slice(0, 2).join(' · '),
          phaseDone: progress.phases.map((p) => p.done),
          phaseTotals: progress.phases.map((p) => p.total),
          phaseNames: progress.phases.map((p) => p.title),
          pct: total ? Math.round((done / total) * 100) : 0,
        };
      })
      .filter((r) => (!stuck ? true : r.reason === stuck))
      .sort(
        (a, b) =>
          HEALTH_RANK[a.eng.health] - HEALTH_RANK[b.eng.health] || a.eng.companyName.localeCompare(b.eng.companyName),
      );
  }, [engagements, getStateForEngagement, phase, stuck, manager]);

  const managerIds = new Set(
    engagements.filter((e) => e.stage !== 'Operational Readiness').map((e) => e.managerId ?? e.adminId ?? 'unassigned'),
  );
  const managerOptions = [...managerIds].map((id) => ({
    value: id,
    label: id === 'unassigned' ? 'Unassigned' : managerName(id),
  }));

  const todayIso = new Date().toISOString().slice(0, 10);
  const projectColumns: EFilingColumn<(typeof rows)[number]>[] = [
    {
      key: 'client',
      header: 'Client',
      width: '22%',
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <CompanyTile name={r.eng.companyName} />
          <span className="truncate font-medium text-ink">{r.eng.companyName}</span>
        </span>
      ),
    },
    { key: 'step', header: 'Now at', width: '20%', render: (r) => <span title={r.step}>{r.step || '—'}</span> },
    {
      key: 'progress',
      header: 'Progress',
      width: '17%',
      render: (r) => (
        <span className="flex items-center gap-2">
          <PhaseBar done={r.phaseDone} totals={r.phaseTotals} names={r.phaseNames} className="min-w-[80px] flex-1" />
          <span className="w-9 shrink-0 text-right text-[12px] tabular-nums text-ink-muted">{r.pct}%</span>
        </span>
      ),
    },
    { key: 'manager', header: 'Manager', width: '12%', render: (r) => managerName(r.eng.managerId ?? r.eng.adminId) },
    { key: 'stage', header: 'Stage', width: '12%', render: (r) => <Tag>{stageDisplayLabel(r.eng.stage)}</Tag> },
    {
      key: 'next',
      header: 'Next',
      width: '72px',
      render: (r) => {
        const d = nextScheduleDate(r.eng.schedule, todayIso);
        return d ? <span className={cn('tabular-nums', d < todayIso && 'font-medium text-danger')}>{shortDate(d)}</span> : '—';
      },
    },
    {
      key: 'health',
      header: 'Health',
      width: '124px',
      render: (r) => (
        <Chip
          fixed
          tone={r.eng.health === 'on-track' ? 'ok' : r.eng.health === 'overdue' ? 'bad' : 'warn'}
          title={STUCK_LABEL[r.reason]}
        >
          {r.eng.health === 'on-track' ? 'On track' : r.eng.health === 'overdue' ? 'Overdue' : 'At risk'}
        </Chip>
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: '56px',
      align: 'center',
      wrap: true,
      render: (r) => (
        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
          <ProjectActionsMenu engagement={r.eng} />
        </span>
      ),
    },
  ];

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <SpectrumTabs
        label="Phase"
        items={[
          { key: 'all', label: 'All phases' },
          { key: 'Pre-Incorporation', label: 'Pre-incorp' },
          { key: 'Post-Incorporation', label: 'Post-incorp' },
        ]}
        value={phase}
        onChange={(k) => setPhase(k as PhaseFilter)}
      />
      <WorkFilterChip
        label="Status"
        value={stuck}
        options={STUCK_FILTERS.map((s) => ({ value: s, label: STUCK_LABEL[s] }))}
        onChange={(v) => setStuck(v as StuckReason | '')}
      />
      <WorkFilterChip label="Manager" value={manager} options={managerOptions} onChange={setManager} />
    </div>
  );

  // Clients, where each one is (K-37, audit 81/82/109/121): a T1 grid with the step, the
  // phase track, manager, stage, next date and health (C-0034).
  const grid = (
    <EFilingGrid
      caption="Clients"
      rows={rows}
      rowKey={(r) => r.eng.id}
      onRowClick={(r) => router.push(adminProjectPath(r.eng, '/app/admin'))}
      empty="No projects match these filters."
      minWidth={900}
      pageSize={title ? Math.max(1, rows.length) : 10}
      columns={projectColumns}
    />
  );

  if (title) {
    return (
      <DashSection title={title} meta={String(rows.length)} bodyClassName="px-2 pb-3 pt-0">
        <div className="px-2 py-3">{filters}</div>
        {grid}
      </DashSection>
    );
  }

  return (
    <div>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Eyebrow>Projects</Eyebrow>
          <Button size="sm" onClick={() => router.push('/app/admin/projects/new')}>
            New project
          </Button>
        </div>
      )}
      <div className="mb-3">{filters}</div>
      {grid}
    </div>
  );
}
