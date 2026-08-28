"use client";

import { useApp } from '@/context/AppContext';
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { DashHero } from '@/components/dash/DashHero';
import { DashSection, DashDonut, DashLegendRow } from '@/components/dash/DashSection';
import { TONE_BADGE, toneForKey } from '@/components/common/IconChip';
import { initialsFromName } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { m } from 'framer-motion';
import { Activity, Briefcase, HeartPulse } from 'lucide-react';
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
  const onTrack = engagements.filter((e) => e.health === 'on-track').length;
  const atRiskOnly = engagements.filter((e) => e.health === 'at-risk').length;
  const overdue = engagements.filter((e) => e.health === 'overdue').length;
  const atRisk = atRiskOnly + overdue;

  return (
    <PageTransition>
      <SEO title="Overview — VCFO Suite" description="Portfolio health, KPIs, and team activity across GCC setup projects." path="/app/manager/overview" />

      <div className="flex flex-col gap-3">
        <DashHero
          kicker={`Portfolio pulse · ${engagements.length} projects`}
          title="Overview"
          ring={{ value: pct, total: 100, caption: '% complete' }}
          stats={[
            { label: 'GCC projects', value: engagements.length, href: '/app/manager/projects' },
            { label: 'checklist complete', value: `${pct}%` },
            { label: 'client requests', value: pending, hot: pending > 0 },
            { label: 'delivery owners', value: teamMembers.length },
          ]}
        />

        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-[minmax(0,1fr)_318px]">
          <DashSection
            icon={Briefcase}
            tone="primary"
            title="Portfolio"
            meta={engagements.length}
            href="/app/manager/projects"
            hrefLabel="GCC setup projects"
            bodyClassName="px-0 pb-0 pt-1"
          >
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
                    className="flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold',
                        TONE_BADGE[toneForKey(e.id)],
                      )}
                    >
                      {initialsFromName(e.companyName).slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-semibold text-ink">{e.companyName}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {stageDisplayLabel(e.stage)} · {intern?.name}
                      </span>
                    </span>
                    <span className="hidden w-32 items-center gap-2 md:flex">
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${epct}%` }} />
                      </span>
                      <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-muted-foreground">
                        {epct}%
                      </span>
                    </span>
                    <span
                      className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold',
                        h.cls,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', h.dot)} />
                      {h.label}
                    </span>
                  </m.button>
                );
              })}
              {engagements.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-muted-foreground">No projects yet.</p>
              ) : null}
            </div>
          </DashSection>

          <div className="flex min-w-0 flex-col gap-3">
            <DashSection icon={HeartPulse} tone="success" title="Portfolio health" meta={atRisk ? `${atRisk} need review` : undefined}>
              <div className="flex min-w-0 items-center gap-3">
                <DashDonut
                  segments={[
                    { n: onTrack, color: 'oklch(var(--success))' },
                    { n: atRiskOnly, color: 'oklch(var(--warning))' },
                    { n: overdue, color: 'oklch(var(--danger))' },
                  ]}
                  centerLabel={engagements.length}
                  centerCaption="projects"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <DashLegendRow swatchClassName="bg-success" label="On track" count={onTrack} />
                  <DashLegendRow swatchClassName="bg-warning" label="Needs review" count={atRiskOnly} />
                  <DashLegendRow swatchClassName="bg-danger" label="Past due" count={overdue} />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </span>
                <span className="shrink-0 text-[11px] font-bold tabular-nums text-muted-foreground">
                  {completed}/{tasks.length} checklist
                </span>
              </div>
            </DashSection>

            <DashSection icon={Activity} tone="sky" title="Live activity" meta={activity.length || undefined}>
              {activity.length === 0 ? (
                <p className="py-3 text-center text-[12.5px] text-muted-foreground">Nothing yet today.</p>
              ) : (
                <div className="flex min-w-0 flex-col">
                  {activity.slice(0, 10).map((a, i) => (
                    <m.div
                      key={a.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * i }}
                      className="flex min-w-0 gap-2.5 rounded-md px-1 py-2 hover:bg-muted/40"
                    >
                      <span
                        className={cn(
                          'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-extrabold',
                          TONE_BADGE[toneForKey(a.actor)],
                        )}
                      >
                        {initialsFromName(a.actor).slice(0, 2)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12.5px] text-ink">
                          <span className="font-semibold">{a.actor}</span>{' '}
                          <span className="text-muted-foreground">{a.verb}</span>{' '}
                          {a.target && <span className="font-semibold">{a.target}</span>}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{a.at}</span>
                      </span>
                    </m.div>
                  ))}
                </div>
              )}
            </DashSection>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
