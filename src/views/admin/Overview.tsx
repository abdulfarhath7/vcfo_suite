"use client";

import { useApp } from '@/context/AppContext';
import { PageTransition, Stagger, StaggerItem } from '@/components/shell/PageTransition';
import { KpiCard } from '@/components/common/KpiCard';
import { SEO } from '@/components/SEO';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const healthMap = {
  'on-track': { label: 'On track', cls: 'bg-success-light text-success-text', dot: 'bg-success' },
  'at-risk': { label: 'Needs review', cls: 'bg-warning-light text-warning-text', dot: 'bg-warning' },
  'overdue': { label: 'Past due', cls: 'bg-danger-light text-danger-text', dot: 'bg-danger' },
} as const;

export default function AdminOverview() {
  const { engagements, tasks, requests, activity, teamMembers } = useApp();
  const router = useRouter();
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const pct = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const pending = requests.filter((r) => r.status === 'pending').length;
  const atRisk = engagements.filter((e) => e.health !== 'on-track').length;

  return (
    <PageTransition>
      <SEO title="Overview — VCFO Suite" description="Portfolio health, KPIs, and team activity across GCC setup projects." path="/app/manager/overview" />

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="serif text-[34px] tracking-tight text-ink">Overview</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">Portfolio pulse across {engagements.length} GCC setup projects</p>
        </div>
      </div>

      <Stagger>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StaggerItem><KpiCard label="GCC setup projects" value={engagements.length} hint={`${atRisk} need manager review`} /></StaggerItem>
          <StaggerItem><KpiCard label="Checklist complete" value={`${pct}%`} delta={`${completed}/${tasks.length}`} trend="up" /></StaggerItem>
          <StaggerItem><KpiCard label="Client requests" value={pending} hint="Waiting on client" /></StaggerItem>
          <StaggerItem><KpiCard label="Delivery owners" value={`${teamMembers.length}`} hint="Project leads on roster" /></StaggerItem>
        </div>
      </Stagger>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-4">
        {/* Portfolio table */}
        <div className="surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-[13px] font-semibold text-ink">Portfolio</div>
            <button type="button" onClick={() => router.push('/app/manager/projects')} className="text-[12px] text-brand hover:underline flex items-center gap-1">GCC setup projects <ArrowUpRight className="w-3 h-3" /></button>
          </div>
          <div className="divide-y divide-border">
            {engagements.map((e, i) => {
              const eTasks = tasks.filter((t) => t.engagementId === e.id);
              const eDone = eTasks.filter((t) => t.status === 'completed').length;
              const epct = eTasks.length ? Math.round((eDone / eTasks.length) * 100) : 0;
              const intern = teamMembers.find((t) => t.id === e.internId);
              const h = healthMap[e.health];
              return (
                <m.button
                  key={e.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i, duration: 0.22 }}
                  onClick={() => router.push(`/app/manager/engagements/${e.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/40 text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-primary-light text-brand text-[11px] font-semibold flex items-center justify-center shrink-0">
                    {e.companyName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-ink truncate">{e.companyName}</div>
                    <div className="text-[11.5px] text-text-tertiary">{e.stage} · {intern?.name}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 w-32">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${epct}%` }} />
                    </div>
                    <span className="text-[11px] text-text-tertiary tabular-nums w-8 text-right">{epct}%</span>
                  </div>
                  <span className={cn('inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[10.5px] font-medium', h.cls)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', h.dot)} />{h.label}
                  </span>
                </m.button>
              );
            })}
          </div>
        </div>

        {/* Activity */}
        <div className="surface">
          <div className="px-4 py-3 border-b border-border text-[13px] font-semibold text-ink">Live activity</div>
          <div className="p-2">
            {activity.slice(0, 10).map((a, i) => (
              <m.div
                key={a.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.03 * i }}
                className="flex gap-2.5 px-2 py-2 rounded-md hover:bg-muted/40"
              >
                <div className="w-6 h-6 rounded-full bg-primary-light text-brand text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  {a.actor.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] text-ink">
                    <span className="font-medium">{a.actor}</span> <span className="text-text-tertiary">{a.verb}</span> {a.target && <span className="font-medium">{a.target}</span>}
                  </div>
                  <div className="text-[11px] text-text-tertiary mt-0.5">{a.at}</div>
                </div>
              </m.div>
            ))}
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
