'use client';

import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { PageTransition, Stagger, StaggerItem } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { AccentKpi } from '@/components/admin/AccentKpi';
import { PhaseTimeline, type Phase } from '@/components/admin/PhaseTimeline';
import { Eyebrow } from '@/components/noir/Eyebrow';
import { GoldButton } from '@/components/noir/GoldButton';
import { NoirCard, Mono } from '@/components/noir';
import { SEO } from '@/components/SEO';
import { adminProjectPath } from '@/lib/project-step-path';
import type { TaskInstance } from '@/data/engagements';
import type { Engagement } from '@/data/engagements';
import { AdminDashboardFilingsPanel } from '@/views/admin/DashboardSecondaryRow';
import {
  Briefcase,
  Calendar,
  Clock,
  ArrowUpRight,
  Plus,
  Send,
  Inbox,
} from 'lucide-react';

export type AdminDashboardViewProps = {
  engagements: Engagement[];
  tasks: TaskInstance[];
  teamMembers: Array<{ id: string; name: string }>;
  headerDateLabel: string;
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
  engagements,
  tasks,
  teamMembers,
  headerDateLabel,
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

  const subtitle = [
    headerDateLabel,
    overdueTasks ? `${overdueTasks} overdue` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PageTransition>
      <SEO
        title="Dashboard — VCFO Suite"
        description="Portfolio overview: filings, approvals, and process health."
        path="/app/manager/dashboard"
      />

      <PageHeader
        title="Dashboard"
        subtitle={subtitle || undefined}
        actions={
          <div className="flex items-center gap-2">
            <GoldButton variant="ghost" onClick={() => router.push('/app/manager/approvals')}>
              Approvals
            </GoldButton>
            <GoldButton onClick={() => router.push('/app/manager/projects/new')}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New project
            </GoldButton>
          </div>
        }
      />

      <Stagger>
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StaggerItem>
            <AccentKpi
              icon={Briefcase}
              label="Active projects"
              value={engagements.length}
              hint={blockers ? `${blockers} at risk` : undefined}
              tone={blockers ? 'warning' : 'primary'}
            />
          </StaggerItem>
          <StaggerItem>
            <AccentKpi
              icon={Calendar}
              label="Due in 2 days"
              value={dueInTwoDays}
              tone={dueInTwoDays ? 'warning' : 'success'}
            />
          </StaggerItem>
          <StaggerItem>
            <AccentKpi
              icon={Send}
              label="Approvals to send"
              value={approvalsToSend}
              tone={approvalsToSend ? 'info' : 'success'}
            />
          </StaggerItem>
          <StaggerItem>
            <AccentKpi
              icon={Inbox}
              label="Approvals received"
              value={approvalsReceived}
              tone={approvalsReceived ? 'warning' : 'success'}
            />
          </StaggerItem>
        </div>
      </Stagger>

      <NoirCard flat className="mb-5 overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <Eyebrow>Process</Eyebrow>
            <p className="mt-1 text-[12px] text-text-tertiary">
              Pre-incorp → Post → Registration → Compliance ·{' '}
              <Mono className="text-ink-soft">{completionRate}% tasks complete</Mono>
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/app/manager/projects')}
            className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-brand hover:text-brand-deep"
          >
            All projects
            <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        <div className="px-5 py-4">
          <PhaseTimeline phases={portfolioPhases} variant="journey" />
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow>By project</Eyebrow>
            <Mono className="text-[10.5px] text-text-tertiary">{engagements.length} total</Mono>
          </div>
          <div className="divide-y divide-border/80">
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
                  onClick={() => router.push(adminProjectPath(e))}
                  className="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel serif text-[13px] text-brand">
                    {e.companyName
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink group-hover:text-brand">
                      {e.companyName}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-text-tertiary">
                      <Mono>{e.stage}</Mono>
                      {intern && <span>{intern.name}</span>}
                      {stuck > 0 && (
                        <span className="inline-flex items-center gap-1 text-warning-text">
                          <Clock className="h-3 w-3" />
                          {stuck} blocked
                        </span>
                      )}
                      {pendingClientActions > 0 && eTasks.some((t) => t.status === 'awaiting-client') && (
                        <span className="text-info-text">Client pending</span>
                      )}
                    </div>
                  </div>
                  <div className="hidden w-28 items-center gap-2 sm:flex">
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-muted">
                      <m.div
                        initial={{ width: 0 }}
                        animate={{ width: `${epct}%` }}
                        transition={{ duration: 0.6, delay: 0.08 + 0.04 * i }}
                        className="h-full rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-hi"
                      />
                    </div>
                    <Mono className="w-8 text-right tabular-nums text-[10.5px]">{epct}%</Mono>
                  </div>
                </m.button>
              );
            })}
          </div>
        </div>
      </NoirCard>

      <div className="mb-2">
        <Eyebrow>Filings</Eyebrow>
      </div>
      <AdminDashboardFilingsPanel engagements={engagements} dueSoon={dueSoon} />
    </PageTransition>
  );
}
