'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Eyebrow } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { CHIP_CLASS, CHIP_COLUMN_CLASS, TONE_SOLID } from '@/components/common/IconChip';
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

/** Firm-wide project list (embedded on admin home). */
export function FirmProjectsPanel({ compact }: { compact?: boolean }) {
  const { engagements, getStateForEngagement } = useApp();
  const router = useRouter();
  const [phase, setPhase] = useState<'all' | 'Pre-Incorporation' | 'Post-Incorporation'>('all');
  const [stuck, setStuck] = useState<StuckReason | 'all'>('all');

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
      .map((e) => {
        const state = getStateForEngagement(e);
        const progress = internCompanyPhaseProgress(e, state);
        const done = progress.phases.reduce((n, p) => n + p.done, 0);
        const total = progress.phases.reduce((n, p) => n + p.total, 0);
        return {
          eng: e,
          reason: deriveStuckReason(e, state),
          step: progress.currentLabel.split(' · ').slice(0, 2).join(' · '),
          pct: total ? Math.round((done / total) * 100) : 0,
        };
      })
      .filter((r) => (stuck === 'all' ? true : r.reason === stuck));
  }, [engagements, getStateForEngagement, phase, stuck]);

  const todayIso = new Date().toISOString().slice(0, 10);
  const projectColumns: EFilingColumn<(typeof rows)[number]>[] = [
    { key: 'client', header: 'Client', width: '22%', render: (r) => <span className="font-semibold">{r.eng.companyName}</span> },
    { key: 'stage', header: 'Stage', width: '12%', render: (r) => stageDisplayLabel(r.eng.stage) },
    { key: 'step', header: 'Step', width: '20%', render: (r) => <span title={r.step}>{r.step || '—'}</span> },
    {
      key: 'progress',
      header: 'Progress',
      width: '13%',
      render: (r) => (
        <span className="flex items-center gap-2">
          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-upcoming-soft">
            <i className="block h-full rounded-[3px] bg-brand" style={{ width: `${r.pct}%` }} />
          </span>
          <span className="w-9 shrink-0 text-right tabular-nums text-ink-muted">{r.pct}%</span>
        </span>
      ),
    },
    { key: 'manager', header: 'Manager', width: '13%', render: (r) => managerName(r.eng.managerId ?? r.eng.adminId) },
    {
      key: 'next',
      header: 'Next date',
      width: '9%',
      render: (r) => {
        const d = nextScheduleDate(r.eng.schedule, todayIso);
        return d ? <span className={cn('tabular-nums', d < todayIso && 'text-danger')}>{shortDate(d)}</span> : '—';
      },
    },
    {
      key: 'health',
      header: 'Health',
      width: '120px',
      render: (r) => (
        <span
          className={cn(
            CHIP_CLASS,
            CHIP_COLUMN_CLASS,
            r.eng.health === 'on-track' ? TONE_SOLID.done : r.eng.health === 'overdue' ? TONE_SOLID.overdue : TONE_SOLID.waiting,
          )}
          title={STUCK_LABEL[r.reason]}
        >
          {r.eng.health === 'on-track' ? 'On track' : r.eng.health === 'overdue' ? 'Overdue' : 'At risk'}
        </span>
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
      <div className="mb-3 flex flex-wrap gap-2">
        {(['all', 'Pre-Incorporation', 'Post-Incorporation'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPhase(p)}
            className={`rounded-sm px-3 py-1 text-[11px] border ${
              phase === p ? 'bg-navy text-on-navy border-navy' : 'border-line text-ink-muted'
            }`}
          >
            {p === 'all' ? 'All phases' : p === 'Pre-Incorporation' ? 'Pre-incorp' : 'Post-incorp'}
          </button>
        ))}
        {(['all', 'waiting_client', 'waiting_manager', 'waiting_lead', 'blocked', 'on_track'] as const).map(
          (s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStuck(s)}
              className={`rounded-sm px-3 py-1 text-[11px] border ${
                stuck === s ? 'bg-surface-sunken text-ink border-brand/40' : 'border-line text-ink-muted'
              }`}
            >
              {s === 'all' ? 'Any status' : STUCK_LABEL[s]}
            </button>
          ),
        )}
      </div>
      {/* Clients, where each one is (K-37, audit 81/82/109/121): an e-Filing grid with the
          stage, current step, progress, manager, next date and health (C-0034). */}
      <EFilingGrid
        caption="Clients"
        rows={rows}
        rowKey={(r) => r.eng.id}
        onRowClick={(r) => router.push(adminProjectPath(r.eng, '/app/admin'))}
        empty="No projects match these filters."
        minWidth={820}
        columns={projectColumns}
      />
    </div>
  );
}
