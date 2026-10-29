'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, ListPlus, Plus } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { DashHero, type DashHeroStat } from '@/components/dash/DashHero';
import { PhaseTimeline, type Phase } from '@/components/admin/PhaseTimeline';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/SEO';
import { useApp } from '@/context/AppContext';
import { isAdminOrManager } from '@/lib/auth';
import { primaryPhaseItems } from '@/lib/projects/project-stuck';
import { isAwaitingManagerDecision } from '@/lib/incorporation/pre-inc-direct-flow';
import { staffNewProjectPath, staffProjectBaseFromPathname, adminProjectPath } from '@/lib/projects/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import { trendWithLive, useHomeTrends } from '@/hooks/use-home-trends';
import { internFirstName, internGreeting, internGreetingHour } from '@/lib/intern/intern-work';
import type { TaskInstance } from '@/data/engagements';
import type { Engagement } from '@/data/engagements';
import type { ComplianceFiling } from '@/data/compliance';
import { AdminDashboardFilingsPanel } from '@/views/admin/DashboardSecondaryRow';
import { DashboardApprovalsPanel } from '@/views/admin/DashboardApprovalsPanel';
import { LeadFocusCard } from '@/components/intern/LeadFocusCard';
import { TeamTodosPanel } from '@/components/staff/TeamTodosPanel';
import { TeamTasksCard, useTeamTaskTools } from '@/components/staff/today/TeamTasksCard';
import { AssignTaskDialog } from '@/components/staff/today/AssignTaskDialog';
import { TaskStatusCard, WorkloadByLeadCard } from '@/components/staff/today/TodayCharts';
import { PhaseProgressGrid } from '@/components/staff/today/PhaseProgressGrid';
import { PersonCell, TodayScopeTabs } from '@/components/staff/today/today-parts';
import {
  buildPhaseProgressRows,
  buildTeamTaskRows,
  engagementInScope,
  type TodayScope,
} from '@/components/staff/today/today-rows';

export type AdminDashboardViewProps = {
  userId?: string;
  engagements: Engagement[];
  tasks: TaskInstance[];
  teamMembers: Array<{ id: string; name: string }>;
  blockers: number;
  pendingClientActions: number;
  overdueTasks: number;
  dueInTwoDays: number;
  approvalsToSend: number;
  approvalsReceived: number;
  dueSoon: Array<{
    id: string;
    filing: string;
    authority: string;
    status: string;
    engagementId: string;
    nextDue: string;
  }>;
  portfolioPhases: Phase[];
  completionRate: number;
  tasksByEngagement: Record<string, TaskInstance[]>;
  /** Every filing the dashboard computed, for the team task rows. */
  filings?: ComplianceFiling[];
};

/** A home card action that shrinks to a 36px icon button on a phone (M-30). */
const PHONE_ICON = 'max-sm:w-9 max-sm:px-0';

/** Main column and a rail, as on every staff Today (prototype TodayScreen GRID). */
const GRID = 'grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2.4fr)_minmax(300px,1fr)]';

/**
 * Manager Today as the board (prototype TodayScreen, C-0107, C-0114): the compact home card with
 * the scope switch and the five numbers, Team tasks beside the approvals, Task
 * status and Workload by lead, then Phase progress beside the upcoming filings and the to-do cards. "Assign task"
 * gives one of the leads on the manager's engagements a task (G-12); it shows in Team tasks
 * and in the lead's Work list.
 */
export function AdminDashboardView({
  userId,
  engagements,
  tasks,
  teamMembers,
  blockers,
  dueInTwoDays,
  approvalsReceived,
  dueSoon,
  portfolioPhases,
  completionRate,
  filings = [],
}: AdminDashboardViewProps) {
  const { user, requests, getStateForEngagement, engagementsLoading } = useApp();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const projectBase = staffProjectBaseFromPathname(pathname, staffBase);
  const newProjectHref = staffNewProjectPath(projectBase);
  const [scope, setScope] = useState<TodayScope>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const now = useMemo(() => new Date(), []);

  const active = useMemo(() => engagements.filter((e) => e.stage !== 'Operational Readiness'), [engagements]);
  const scopeCounts = useMemo(() => {
    const incorporating = active.filter((e) => engagementInScope('incorporating', e, getStateForEngagement(e))).length;
    return { all: active.length, incorporating, compliance: active.length - incorporating };
  }, [active, getStateForEngagement]);
  const scoped = useMemo(
    () => active.filter((e) => engagementInScope(scope, e, getStateForEngagement(e))),
    [active, scope, getStateForEngagement],
  );
  const scopedIds = useMemo(() => new Set(scoped.map((e) => e.id)), [scoped]);

  const teamRows = useMemo(
    () =>
      buildTeamTaskRows({
        engagements: scoped,
        getState: getStateForEngagement,
        filings,
        requests,
        tasks,
        leads: teamMembers,
        projectBase,
        now,
      }),
    [scoped, getStateForEngagement, filings, requests, tasks, teamMembers, projectBase, now],
  );
  const phaseRows = useMemo(
    () =>
      buildPhaseProgressRows({
        engagements: scoped,
        getState: getStateForEngagement,
        href: (e) => adminProjectPath(e, projectBase),
        now,
      }),
    [scoped, getStateForEngagement, projectBase, now],
  );
  const scopedDueSoon = dueSoon.filter((f) => scopedIds.has(f.engagementId));

  /* Five numbers (R-18, E-04, E-05). Overdue, Waiting on clients and Due this week count the
     Team tasks rows, and each opens Team tasks on the matching saved view. */
  const open = teamRows.filter((r) => r.status !== 'Done');
  const overdueRows = teamRows.filter((r) => r.status === 'Overdue');
  const overdue = overdueRows.length;
  const overdueClients = new Set(overdueRows.map((r) => r.engagementId)).size;
  const waitingRows = teamRows.filter((r) => r.status === 'Waiting' && r.withClient);
  const waitingOnClients = waitingRows.length;
  const waitingClients = new Set(waitingRows.map((r) => r.engagementId)).size;
  const dueWeek = teamRows.filter((r) => r.status === 'Due soon').length;
  const approvalClients = engagements.filter((e) => {
    const state = getStateForEngagement(e);
    return primaryPhaseItems().some((item) => isAwaitingManagerDecision(item.id, state[item.id]));
  }).length;
  const tasksHref = (view: string) => `${staffBase}/dashboard?view=${view}#team-tasks`;
  // Only "Needs your approval" has a past that the stored rows give (review history).
  const trends = useHomeTrends('manager', { enabled: isAdminOrManager(user?.role) });
  const heroStats: DashHeroStat[] = [
    {
      label: 'Active projects',
      value: scoped.length,
      href: `${projectBase}/projects`,
      note: blockers > 0 && scope === 'all' ? `${blockers} at risk` : `${open.length} open tasks`,
      how: 'Your projects that are still being set up, in the clients shown.',
    },
    {
      label: 'Needs your approval',
      value: approvalsReceived,
      href: `${projectBase}/approvals`,
      hot: approvalsReceived > 0,
      trend: trendWithLive(trends, 'approvals', approvalsReceived),
      trendTone: 'warn',
      note: approvalClients > 0 ? `${approvalClients} ${approvalClients === 1 ? 'client' : 'clients'}` : undefined,
      how: 'Steps a lead or a client sent you to approve before they move on.',
    },
    {
      label: 'Overdue',
      value: overdue,
      hot: overdue > 0,
      href: tasksHref('overdue'),
      note: overdueClients > 0 ? `${overdueClients} ${overdueClients === 1 ? 'client' : 'clients'}` : undefined,
      how: 'Team tasks past their due date: steps, filings, document requests and assigned tasks.',
    },
    {
      label: 'Waiting on clients',
      value: waitingOnClients,
      href: tasksHref('waiting'),
      note: waitingClients > 0 ? `${waitingClients} ${waitingClients === 1 ? 'client' : 'clients'}` : undefined,
      how: 'Team tasks the client still owes: a step to fill or a document to upload.',
    },
    {
      label: 'Due this week',
      value: dueWeek,
      href: tasksHref('week'),
      note: dueInTwoDays > 0 ? `${dueInTwoDays} filings in 2 days` : undefined,
      how: 'Open team tasks due in the next seven days.',
    },
  ];
  const tools = useTeamTaskTools({
    storageScope: user?.id ?? 'manager',
    leads: teamMembers,
    canReassign: isAdminOrManager(user?.role),
  });

  const greet = internGreeting(internGreetingHour(now));
  const first = internFirstName(user?.name ?? '');

  return (
    <PageTransition>
      <SEO
        title="Dashboard — VCFO Suite"
        description="Portfolio overview: filings, approvals, and process health."
        path={`${staffBase}/dashboard`}
      />

      <div className="flex flex-col gap-5">
        <DashHero
          title={first ? `Good ${greet}, ${first}` : 'Dashboard'}
          stats={heroStats}
          scope={<TodayScopeTabs value={scope} onChange={setScope} counts={scopeCounts} />}
        >
          {/* M-30: on a phone the actions are 36px icon buttons, so they fit beside the switch. */}
          <Button variant="secondary" asChild className={PHONE_ICON}>
            <Link href={`${projectBase}/approvals`} title="Approvals">
              <Inbox aria-hidden />
              <span className="max-sm:sr-only">Approvals</span>
            </Link>
          </Button>
          <Button variant="secondary" onClick={() => setAssignOpen(true)} className={PHONE_ICON} title="Assign task">
            <ListPlus aria-hidden />
            <span className="max-sm:sr-only">Assign task</span>
          </Button>
          <Button asChild className={PHONE_ICON}>
            <Link href={newProjectHref} title="New project">
              <Plus aria-hidden />
              <span className="max-sm:sr-only">New project</span>
            </Link>
          </Button>
        </DashHero>

        <div className={GRID}>
          <div id="team-tasks" className="min-w-0 scroll-mt-24">
            <TeamTasksCard rows={teamRows} tools={tools} loading={engagementsLoading} />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <DashboardApprovalsPanel />
            <TaskStatusCard rows={teamRows} />
            <WorkloadByLeadCard rows={teamRows} rebalanceHref={`${projectBase}/team`} />
          </div>
        </div>

        <div className={GRID}>
          <PhaseProgressGrid
            rows={phaseRows}
            meta={`${completionRate}% tasks complete`}
            href={`${projectBase}/projects`}
            hrefLabel="All projects"
            before={<PhaseTimeline phases={portfolioPhases} variant="journey" />}
            extraColumns={[
              {
                key: 'lead',
                header: 'Lead',
                width: '120px',
                render: (r) => {
                  const lead = teamMembers.find((t) => t.id === r.leadId);
                  return lead ? <PersonCell name={lead.name} /> : <span className="text-ink-faint">—</span>;
                },
              },
            ]}
          />
          <div className="flex min-w-0 flex-col gap-5">
            <AdminDashboardFilingsPanel engagements={engagements} dueSoon={scopedDueSoon} />
            {userId ? (
              <>
                <LeadFocusCard userId={userId} items={[]} />
                <TeamTodosPanel userId={userId} />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <AssignTaskDialog open={assignOpen} onOpenChange={setAssignOpen} engagements={active} teamMembers={teamMembers} />
    </PageTransition>
  );
}
