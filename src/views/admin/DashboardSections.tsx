'use client';

import Link from 'next/link';
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import { useRouter, usePathname } from 'next/navigation';
import { m } from 'framer-motion';
import { PageTransition } from '@/components/shell/PageTransition';
import { DashHero, type DashHeroStat } from '@/components/dash/DashHero';
import { DashSection } from '@/components/dash/DashSection';
import { PhaseTimeline, type Phase } from '@/components/admin/PhaseTimeline';
import { TONE_BADGE, toneForKey } from '@/components/common/IconChip';
import { initialsFromName } from '@/lib/auth';
import { SEO } from '@/components/SEO';
import { adminProjectPath, staffNewProjectPath, staffProjectBaseFromPathname } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import type { TaskInstance } from '@/data/engagements';
import type { Engagement } from '@/data/engagements';
import { AdminDashboardFilingsPanel } from '@/views/admin/DashboardSecondaryRow';
import { LeadFocusCard } from '@/components/intern/LeadFocusCard';
import { TeamTodosPanel } from '@/components/staff/TeamTodosPanel';
import { Briefcase, Clock, Plus, Inbox } from 'lucide-react';

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
};

export function AdminDashboardView({
  userId,
  engagements,
  teamMembers,
  blockers,
  pendingClientActions,
  overdueTasks,
  dueInTwoDays,
  approvalsToSend,
  approvalsReceived,
  dueSoon,
  portfolioPhases,
  completionRate,
  tasksByEngagement,
}: AdminDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const staffBase = useStaffBasePath();
  const projectBase = staffProjectBaseFromPathname(pathname, staffBase);
  const newProjectHref = staffNewProjectPath(projectBase);

  const heroStats: DashHeroStat[] = [
    { label: 'active projects', value: engagements.length, href: `${projectBase}/projects` },
    {
      label: 'due in 2 days',
      value: dueInTwoDays,
      href: `${projectBase}/compliance`,
      hot: dueInTwoDays > 0,
    },
    { label: 'approvals to send', value: approvalsToSend, href: `${projectBase}/approvals` },
    {
      label: 'approvals received',
      value: approvalsReceived,
      href: `${projectBase}/approvals`,
      hot: approvalsReceived > 0,
    },
  ];
  if (blockers > 0) {
    heroStats.push({
      label: 'at risk',
      value: blockers,
      href: `${projectBase}/projects`,
      hot: true,
    });
  }
  if (overdueTasks > 0) {
    heroStats.push({ label: 'overdue', value: overdueTasks, hot: true });
  }

  return (
    <PageTransition>
      <SEO
        title="Dashboard — VCFO Suite"
        description="Portfolio overview: filings, approvals, and process health."
        path={`${staffBase}/dashboard`}
      />

      <div className="flex flex-col gap-3">
        <DashHero
          title="Dashboard"
          ring={{ value: completionRate, total: 100, caption: '% complete' }}
          stats={heroStats}
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`${projectBase}/approvals`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-3.5 py-1.5 text-[12px] font-extrabold text-primary transition-opacity hover:opacity-80"
          >
            <Inbox className="h-3.5 w-3.5" aria-hidden />
            Approvals
          </Link>
          <Link
            href={newProjectHref}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-extrabold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New project
          </Link>
        </div>

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <div className="flex min-w-0 flex-col gap-3">
            {userId ? (
              <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                <LeadFocusCard userId={userId} items={[]} />
                <TeamTodosPanel userId={userId} />
              </div>
            ) : null}

            <DashSection
              icon={Briefcase}
              tone="primary"
              title="Process"
              meta={`${completionRate}% tasks complete`}
              href={`${projectBase}/projects`}
              hrefLabel="All projects"
            >
              <PhaseTimeline phases={portfolioPhases} variant="journey" />

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted-foreground">
                  By project
                </span>
                <span className="inline-flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary-light px-1.5 text-[11px] font-extrabold tabular-nums text-primary">
                  {engagements.length}
                </span>
              </div>

              <div className="divide-y divide-border">
                {engagements.map((e, i) => {
                  const eTasks = tasksByEngagement[e.id] ?? [];
                  const eDone = eTasks.filter((t) => t.status === 'completed').length;
                  const epct = eTasks.length ? Math.round((eDone / eTasks.length) * 100) : 0;
                  const intern = teamMembers.find((t) => t.id === e.internId);
                  const stuck = eTasks.filter(
                    (t) => t.status === 'awaiting-client' || t.status === 'overdue',
                  ).length;

                  return (
                    <m.button
                      key={e.id}
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * i, duration: 0.24 }}
                      onClick={() => router.push(adminProjectPath(e, projectBase))}
                      className="group flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-muted/30"
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold ${TONE_BADGE[toneForKey(e.id)]}`}
                      >
                        {initialsFromName(e.companyName).slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-ink transition-colors group-hover:text-primary">
                          {e.companyName}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                          <span
                            className={`inline-flex rounded-full px-2 py-px text-[10px] font-extrabold ${TONE_BADGE[toneForKey(e.stage)]}`}
                          >
                            {stageDisplayLabel(e.stage)}
                          </span>
                          {intern && <span>{intern.name}</span>}
                          {stuck > 0 && (
                            <span className="inline-flex items-center gap-1 font-semibold text-warning-text">
                              <Clock className="h-3 w-3" aria-hidden />
                              {stuck} blocked
                            </span>
                          )}
                          {pendingClientActions > 0 &&
                            eTasks.some((t) => t.status === 'awaiting-client') && (
                              <span className="font-semibold text-info-text">Client pending</span>
                            )}
                        </span>
                      </span>
                      <span className="hidden w-28 items-center gap-2 sm:flex">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <m.span
                            initial={{ width: 0 }}
                            animate={{ width: `${epct}%` }}
                            transition={{ duration: 0.6, delay: 0.08 + 0.04 * i }}
                            className="block h-full rounded-full bg-primary"
                          />
                        </span>
                        <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted-foreground">
                          {epct}%
                        </span>
                      </span>
                    </m.button>
                  );
                })}
              </div>
            </DashSection>
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <AdminDashboardFilingsPanel engagements={engagements} dueSoon={dueSoon} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
