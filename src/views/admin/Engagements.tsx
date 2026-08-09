"use client";

/**
 * Legacy list view — superseded by `src/views/admin/Projects.tsx`.
 * Route `/app/manager/engagements` redirects to `/app/manager/projects`.
 * Project creation uses `createProjectWithClient` via CreateProjectForm.
 */

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';

const healthMap = {
  'on-track': { label: 'On track', cls: 'bg-success-light text-success-text', dot: 'bg-success' },
  'at-risk': { label: 'Needs review', cls: 'bg-warning-light text-warning-text', dot: 'bg-warning' },
  'overdue': { label: 'Past due', cls: 'bg-danger-light text-danger-text', dot: 'bg-danger' },
} as const;

export default function AdminEngagements() {
  const { engagements, tasks, teamMembers } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');

  const filtered = engagements.filter((e) => e.companyName.toLowerCase().includes(q.toLowerCase()));

  return (
    <PageTransition>
      <SEO title="GCC Setup Projects — VCFO Suite" description="All GCC setup projects with progress, setup phase, and delivery owner." path="/app/manager/engagements" />

      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="serif text-[32px] tracking-tight text-ink">GCC setup projects</h1>
          <p className="text-[13px] text-text-tertiary mt-0.5">{engagements.length} in portfolio</p>
        </div>
        <Button size="sm" onClick={() => router.push('/app/manager/projects/new')}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />Start GCC project
        </Button>
      </div>

      <div className="surface overflow-hidden">
        <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
          <Search className="w-3.5 h-3.5 text-text-tertiary" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search by company name…"
            aria-label="Search by company name"
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-text-tertiary"
          />
        </div>
        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 px-4 py-2 bg-muted/50 border-b border-border text-[11px] uppercase tracking-wider text-text-tertiary font-medium">
          <div>Company</div><div>Setup phase</div><div>Delivery owner</div><div>Progress</div><div>Health</div>
        </div>
        {filtered.map((e, i) => {
          const eTasks = tasks.filter((t) => t.engagementId === e.id);
          const done = eTasks.filter((t) => t.status === 'completed').length;
          const pct = eTasks.length ? Math.round((done / eTasks.length) * 100) : 0;
          const intern = teamMembers.find((t) => t.id === e.internId);
          const h = healthMap[e.health];
          return (
            <m.button
              key={e.id}
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 * i }}
              onClick={() => router.push(`/app/manager/engagements/${e.id}`)}
              className="w-full grid grid-cols-[1.5fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-primary-light text-brand text-[10.5px] font-semibold flex items-center justify-center shrink-0">
                  {e.companyName.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                </div>
                <div className="text-[13px] font-medium text-ink truncate">{e.companyName}</div>
              </div>
              <div className="text-[12px] text-text-secondary">{e.stage}</div>
              <div className="text-[12px] text-text-secondary">{intern?.name}</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                  <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-text-tertiary tabular-nums">{pct}%</span>
              </div>
              <span className={cn('inline-flex items-center gap-1.5 px-2 h-5 rounded-full text-[10.5px] font-medium', h.cls)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', h.dot)} />{h.label}
              </span>
            </m.button>
          );
        })}
      </div>
    </PageTransition>
  );
}
