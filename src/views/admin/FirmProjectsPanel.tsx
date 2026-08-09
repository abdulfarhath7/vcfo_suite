'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Surface, Eyebrow } from '@/components/noir';
import { Button } from '@/components/ui/button';
import { ProjectActionsMenu } from '@/components/admin/ProjectActionsMenu';
import { deriveStuckReason, STUCK_LABEL, type StuckReason } from '@/lib/project-stuck';
import { adminProjectPath } from '@/lib/project-step-path';

type ManagerOption = { id: string; name: string; email: string };

async function fetchManagers(): Promise<ManagerOption[]> {
  const res = await fetch('/api/admin/managers');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body.managers ?? []) as ManagerOption[];
}

/** Firm-wide project list (embedded on admin home). */
export function FirmProjectsPanel({ compact }: { compact?: boolean }) {
  const { engagements, getStateForEngagement, teamMembers, internOptions } = useApp();
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
  const leadNames = (e: (typeof engagements)[number]) => {
    const ids =
      e.leadIds && e.leadIds.length > 0
        ? e.leadIds
        : e.internId?.trim()
          ? [e.internId]
          : [];
    if (ids.length === 0) return 'Unassigned';
    const owners = internOptions.length ? internOptions : teamMembers;
    return ids
      .map(
        (id) =>
          owners.find((t) => t.id === id)?.name ??
          teamMembers.find((t) => t.id === id)?.name ??
          id,
      )
      .join(', ');
  };

  const rows = useMemo(() => {
    return engagements
      .filter((e) => e.stage !== 'Operational Readiness')
      .filter((e) => (phase === 'all' ? true : e.stage === phase))
      .map((e) => ({
        eng: e,
        reason: deriveStuckReason(e, getStateForEngagement(e)),
      }))
      .filter((r) => (stuck === 'all' ? true : r.reason === stuck));
  }, [engagements, getStateForEngagement, phase, stuck]);

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
            className={`rounded-full px-3 py-1 text-[11px] border ${
              phase === p ? 'bg-orange-600 text-white border-orange-600' : 'border-border text-muted-foreground'
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
              className={`rounded-full px-3 py-1 text-[11px] border ${
                stuck === s ? 'bg-raised text-foreground border-orange-300' : 'border-border text-muted-foreground'
              }`}
            >
              {s === 'all' ? 'Any status' : STUCK_LABEL[s]}
            </button>
          ),
        )}
      </div>
      <Surface className="divide-y divide-border">
        <div className="px-4 py-3">
          <Eyebrow>{rows.length} projects</Eyebrow>
        </div>
        {rows.length === 0 ? (
          <p className="p-6 text-[13px] text-muted-foreground">No projects match these filters.</p>
        ) : (
          rows.map(({ eng, reason }) => (
            <div
              key={eng.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/40"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => router.push(adminProjectPath(eng, '/app/admin'))}
              >
                <div className="text-[13px] font-medium truncate">{eng.companyName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {eng.stage === 'Pre-Incorporation'
                    ? 'Pre-incorp'
                    : eng.stage === 'Post-Incorporation'
                      ? 'Post-incorp'
                      : eng.stage}{' '}
                  · PM {managerName(eng.managerId ?? eng.adminId)} · Lead {leadNames(eng)} ·{' '}
                  {STUCK_LABEL[reason]}
                </div>
              </button>
              <div className="flex shrink-0 items-center gap-2">
                <div className="text-[11px] mono uppercase text-muted-foreground">{eng.health}</div>
                <ProjectActionsMenu engagement={eng} />
              </div>
            </div>
          ))
        )}
      </Surface>
    </div>
  );
}
