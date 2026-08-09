'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Surface, Eyebrow } from '@/components/noir';
import { AccentKpi } from '@/components/admin/AccentKpi';
import { IconChip } from '@/components/common/IconChip';
import { Briefcase, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { deriveStuckReason, primaryPhaseItems } from '@/lib/project-stuck';
import { isAwaitingReview } from '@/lib/checklist-item-review';
import { FirmProjectsPanel } from '@/views/admin/FirmProjectsPanel';

type ManagerOption = { id: string; name: string; email: string };

async function fetchManagers(): Promise<ManagerOption[]> {
  const res = await fetch('/api/admin/managers');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body.managers ?? []) as ManagerOption[];
}

export default function FirmDashboard() {
  const { engagements, getStateForEngagement } = useApp();
  const today = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  const managersQuery = useQuery({
    queryKey: ['admin-managers'],
    queryFn: fetchManagers,
    staleTime: 5 * 60_000,
  });

  const pulse = useMemo(() => {
    let total = 0;
    let pending = 0;
    let good = 0;
    for (const eng of engagements) {
      if (eng.stage === 'Operational Readiness') continue;
      total += 1;
      const reason = deriveStuckReason(eng, getStateForEngagement(eng));
      if (reason === 'on_track') good += 1;
      else pending += 1;
    }
    return { total, pending, good };
  }, [engagements, getStateForEngagement]);

  const pendingApprovals = useMemo(() => {
    let n = 0;
    for (const eng of engagements) {
      const state = getStateForEngagement(eng);
      for (const item of primaryPhaseItems()) {
        if (isAwaitingReview(state[item.id])) n += 1;
      }
    }
    return n;
  }, [engagements, getStateForEngagement]);

  const managerStrip = useMemo(() => {
    const byManager = new Map<
      string,
      { managerId: string; open: number; stuck: number; awaitingPm: number }
    >();
    for (const eng of engagements) {
      if (eng.stage === 'Operational Readiness') continue;
      const mid = eng.managerId ?? eng.adminId ?? 'unassigned';
      const row = byManager.get(mid) ?? {
        managerId: mid,
        open: 0,
        stuck: 0,
        awaitingPm: 0,
      };
      row.open += 1;
      const state = getStateForEngagement(eng);
      const reason = deriveStuckReason(eng, state);
      if (reason !== 'on_track') row.stuck += 1;
      for (const item of primaryPhaseItems()) {
        if (isAwaitingReview(state[item.id])) row.awaitingPm += 1;
      }
      byManager.set(mid, row);
    }
    return Array.from(byManager.values()).sort((a, b) => b.open - a.open);
  }, [engagements, getStateForEngagement]);

  const nameFor = (id: string) => {
    if (id === 'unassigned') return 'Unassigned';
    return managersQuery.data?.find((m) => m.id === id)?.name ?? 'Project manager';
  };
  const emailFor = (id: string) =>
    managersQuery.data?.find((m) => m.id === id)?.email ?? '';

  return (
    <PageTransition>
      <SEO title="Admin home — VCFO Suite" description="Firm-wide portfolio pulse." path="/app/admin/dashboard" />
      <PageHeader accent="amber" title="Firm home" subtitle={today} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <AccentKpi
          label="Total projects"
          value={pulse.total}
          tone="primary"
          icon={Briefcase}
          href="/app/admin/projects"
        />
        <AccentKpi
          label="Needs attention"
          value={pulse.pending + pendingApprovals}
          tone="warning"
          icon={AlertTriangle}
          hint={`${pendingApprovals} awaiting approval · ${pulse.pending} stuck`}
          href="/app/admin/approvals"
        />
        <AccentKpi label="On track" value={pulse.good} tone="success" icon={CheckCircle2} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <FirmProjectsPanel />

        <Surface className="h-fit p-5">
          <Eyebrow>Managers</Eyebrow>
          {managerStrip.length === 0 ? (
            <div className="mt-3 flex items-center gap-2.5">
              <IconChip icon={Briefcase} tone="neutral" size="sm" />
              <p className="text-[13px] text-muted-foreground">No open Pre/Post projects.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {managerStrip.map((row) => (
                <li key={row.managerId} className="py-3">
                  {row.managerId === 'unassigned' ? (
                    <div className="text-[13px] font-medium text-foreground">
                      {nameFor(row.managerId)}
                    </div>
                  ) : (
                    <Link
                      href={`/app/admin/people?managerId=${row.managerId}`}
                      className="text-[13px] font-medium text-foreground hover:text-primary-dark hover:underline"
                    >
                      {nameFor(row.managerId)}
                    </Link>
                  )}
                  {emailFor(row.managerId) ? (
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {emailFor(row.managerId)}
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-md border border-border px-2 py-0.5">
                      {row.open} open projects
                    </span>
                    <span className="rounded-md border border-border px-2 py-0.5">
                      {row.stuck} need attention
                    </span>
                    <span className="rounded-md border border-border px-2 py-0.5">
                      {row.awaitingPm} awaiting PM approval
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>
    </PageTransition>
  );
}
