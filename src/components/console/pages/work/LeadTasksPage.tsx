'use client';

/**
 * TASKS — /app/intern/tasks, the project lead's planner (live view
 * src/views/intern/MyWork.tsx, in the console's design): the lead's open
 * steps, filings and document requests as list, board or timeline (plus the
 * calendar and their to-dos). Every live function stays: the view switch
 * (remembered, and in the URL), company / steps-or-filings / day filters and
 * the focus and tag links from Today, J / K / Enter in the list, and each
 * item's action (Continue, Review, Deliver, Send reminder, Email manager
 * again, Open filing). Manager-only controls are not shown.
 */
import { Suspense } from 'react';
import { useCrumbs } from '../../runtime';
import { Planner } from './planner/Planner';
import { usePlan } from './planner/data';
import { useLeadTasksBadge } from './badges';

const ME = { mode: 'lead-me' } as const;

function Inner() {
  useCrumbs(['Tasks']);
  useLeadTasksBadge();
  const plan = usePlan(ME);
  const open = plan.items.filter((i) => i.st !== 'done');
  const companies = new Set(open.map((i) => i.clientId)).size;
  return (
    <>
      <div className="sec-h">
        <h2>Tasks</h2>
        <span className="sec-count">{plan.loading ? 'Loading…' : `${open.length} open · ${companies} ${companies === 1 ? 'company' : 'companies'}`}</span>
        <span className="sp" />
        <span className="small">Your steps, filings and requests across your clients</span>
      </div>
      <Planner who={ME} leads={[]} />
    </>
  );
}

export function LeadTasksPage() {
  return (
    <Suspense fallback={<div className="glass panel mx-p"><div className="sec-load">Loading your tasks…</div></div>}>
      <Inner />
    </Suspense>
  );
}
