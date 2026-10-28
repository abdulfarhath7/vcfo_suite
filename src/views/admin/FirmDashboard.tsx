'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashHero } from '@/components/dash/DashHero';
import { DashSection, DashDonut, DashLegendRow } from '@/components/dash/DashSection';
import { EFilingGrid } from '@/components/dash/EFilingGrid';
import { Activity } from 'lucide-react';
import { deriveStuckReason, primaryPhaseItems } from '@/lib/projects/project-stuck';
import { FirmProjectsPanel } from '@/views/admin/FirmProjectsPanel';
import { LeadFocusCard } from '@/components/intern/LeadFocusCard';
import { TeamTodosPanel } from '@/components/staff/TeamTodosPanel';
import { internFirstName, internGreeting, internGreetingHour } from '@/lib/intern/intern-work';
import { isAwaitingManagerDecision } from '@/lib/incorporation/pre-inc-direct-flow';

type ManagerOption = { id: string; name: string; email: string };

async function fetchManagers(): Promise<ManagerOption[]> {
  const res = await fetch('/api/admin/managers');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body.managers ?? []) as ManagerOption[];
}

export default function FirmDashboard() {
  const { user, engagements, getStateForEngagement } = useApp();
  const greet = internGreeting(internGreetingHour(new Date()));
  const first = internFirstName(user?.name ?? '');
  /**
   * A super admin reaches this page through the rail's "Firm" jump, having
   * already been greeted on their own Overview. A second greeting card here
   * reads as someone else's home, so the firm view opens straight on the work.
   * Its numbers are not lost: the Portfolio health donut in the right rail
   * carries the same on-track / stuck / awaiting-PM counts and the total.
   */
  const showGreeting = user?.role !== 'super_admin';

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
        if (isAwaitingManagerDecision(item.id, state[item.id])) n += 1;
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
        if (isAwaitingManagerDecision(item.id, state[item.id])) row.awaitingPm += 1;
      }
      byManager.set(mid, row);
    }
    return Array.from(byManager.values()).sort((a, b) => b.open - a.open);
  }, [engagements, getStateForEngagement]);

  const nameFor = (id: string) => {
    if (id === 'unassigned') return 'Unassigned';
    return managersQuery.data?.find((m) => m.id === id)?.name ?? 'Project manager';
  };

  return (
    <PageTransition>
      <SEO title="Admin home — VCFO Suite" description="Firm-wide portfolio pulse." path="/app/admin/dashboard" />

      <div className="flex flex-col gap-3">
        {showGreeting ? (
          <DashHero
            title={first ? `Good ${greet}, ${first}` : 'Firm home'}
            ring={{ value: pulse.good, total: pulse.total, caption: 'on track' }}
            stats={[
              { label: 'projects', value: pulse.total, href: '/app/admin/projects' },
              {
                label: 'need attention',
                value: pulse.pending + pendingApprovals,
                href: '/app/admin/approvals',
                hot: pulse.pending + pendingApprovals > 0,
              },
              { label: 'awaiting approval', value: pendingApprovals, href: '/app/admin/approvals' },
              { label: 'on track', value: pulse.good },
            ]}
          />
        ) : null}

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            <FirmProjectsPanel />
            {/* Managers (K-37, C-0034): an e-Filing grid under the clients grid. */}
            <DashSection title="Managers" meta={managerStrip.length || undefined} bodyClassName="p-3">
              <EFilingGrid
                caption="Managers"
                rows={managerStrip}
                rowKey={(row) => row.managerId}
                empty="No open Pre/Post projects."
                minWidth={480}
                columns={[
                  {
                    key: 'name',
                    header: 'Manager',
                    width: '40%',
                    render: (row) =>
                      row.managerId === 'unassigned' ? (
                        <span className="font-semibold">{nameFor(row.managerId)}</span>
                      ) : (
                        <Link href={`/app/admin/people?managerId=${row.managerId}`} className="font-semibold text-ink hover:text-brand hover:underline">
                          {nameFor(row.managerId)}
                        </Link>
                      ),
                  },
                  { key: 'open', header: 'Open', align: 'right', render: (row) => <span className="tabular-nums">{row.open}</span> },
                  { key: 'stuck', header: 'Stuck', align: 'right', render: (row) => <span className={row.stuck ? 'tabular-nums text-danger' : 'tabular-nums'}>{row.stuck}</span> },
                  { key: 'awaiting', header: 'Awaiting PM', align: 'right', render: (row) => <span className="tabular-nums">{row.awaitingPm}</span> },
                ]}
              />
            </DashSection>
            {user?.id ? (
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                <LeadFocusCard userId={user.id} items={[]} />
                <TeamTodosPanel userId={user.id} />
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <DashSection icon={Activity} tone="success" title="Portfolio health">
              <div className="flex min-w-0 items-center gap-3">
                <DashDonut
                  segments={[
                    { n: pulse.good, color: 'oklch(var(--positive))' },
                    { n: pulse.pending, color: 'oklch(var(--warning))' },
                    { n: pendingApprovals, color: 'oklch(var(--info))' },
                  ]}
                  centerLabel={pulse.total}
                  centerCaption="projects"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <DashLegendRow swatchClassName="bg-positive" label="On track" count={pulse.good} />
                  <DashLegendRow swatchClassName="bg-warning" label="Stuck" count={pulse.pending} />
                  <DashLegendRow
                    swatchClassName="bg-ink-faint"
                    label="Awaiting PM"
                    count={pendingApprovals}
                  />
                </div>
              </div>
            </DashSection>

          </div>
        </div>
      </div>
    </PageTransition>
  );
}
