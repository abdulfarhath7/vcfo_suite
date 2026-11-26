'use client';

import type { ReactNode } from 'react';
import { DashSection } from '@/components/dash/DashSection';
import { EmptyState } from '@/components/ui/empty-state';
import { useApp } from '@/context/AppContext';
import { useAgentsToday } from '@/hooks/use-agent-runs';
import { roleAppSegment } from '@/lib/auth-routes';
import type { AgentRunItem } from '@/lib/card-agents/overview';
import { cn } from '@/lib/utils';
import { AgentRunRow } from './agent-run-parts';

/**
 * AGENTS TODAY (docs/specs/live-portal-browser/MASTER-PLAN.md screen 1) — one section on the staff
 * home of the project lead, the manager, the admin and the super admin. A band of four counts
 * (your turn, running, filed today, due in seven days with how many are ready), then the Your turn
 * and Running lists, each row linking to its card. The repository scopes it: a lead sees only the
 * engagements they lead. With nothing open the lists give way to one line.
 */

const STAFF = new Set(['super_admin', 'admin', 'manager', 'intern']);

/** One count in the band: an 11px label, a 20px figure and a muted line (R-60: inside the card). */
function Count({ label, value, hint, hot }: { label: string; value: number; hint: ReactNode; hot?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <span className="block text-[11px] font-semibold tracking-[0.06em] text-ink-muted">{label}</span>
      <span className={cn('mt-1 block text-[20px] font-semibold leading-6 tabular-nums text-ink', hot && value > 0 && 'text-brand-text')}>{value}</span>
      <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">{hint}</span>
    </div>
  );
}

function RunList({ title, count, runs, empty }: { title: string; count: number; runs: AgentRunItem[]; empty: string }) {
  return (
    <section aria-label={title} className="min-w-0">
      <h3 className="px-4 pb-1 pt-3 text-[12.5px] font-medium text-ink">
        {title} <span className="font-normal text-ink-muted">({count})</span>
      </h3>
      {runs.length === 0 ? (
        <p className="px-4 pb-3 text-[12.5px] text-ink-muted">{empty}</p>
      ) : (
        <ul>
          {runs.map((run) => (
            <AgentRunRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function AgentsToday() {
  const { user } = useApp();
  const staff = STAFF.has(user?.role ?? '');
  const query = useAgentsToday(staff);
  if (!staff) return null;
  const s = query.data;
  const runsHref = `/app/${roleAppSegment(user?.role)}/assist-runs`;

  return (
    <DashSection title="Agents today" href={runsHref} hrefLabel="All runs" loading={query.isLoading} flush>
      {query.isError ? (
        <p role="alert" className="m-4 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
          Could not load the agents. Refresh the page.
        </p>
      ) : s ? (
        <>
          <div className="grid grid-cols-2 divide-line-soft border-b border-line-soft md:grid-cols-4 md:divide-x [&>*:nth-child(odd)]:max-md:border-r [&>*:nth-child(-n+2)]:max-md:border-b [&>*]:border-line-soft">
            <Count label="Your turn" value={s.yourTurn} hint="needs you" hot />
            <Count label="Running" value={s.running} hint="watch live" hot />
            <Count label="Filed today" value={s.filedToday} hint="SRN or ARN saved" />
            <Count label="Due in 7 days" value={s.dueIn7} hint={`ready: ${s.dueReady}`} />
          </div>
          {s.yourTurn + s.running === 0 ? (
            <div className="p-4">
              <EmptyState title="No agent is running or waiting for you." />
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-line-soft">
              <RunList title="Your turn" count={s.yourTurn} runs={s.yourTurnRuns} empty="Nothing waits for you." />
              <RunList title="Running" count={s.running} runs={s.runningRuns} empty="No agent is running." />
            </div>
          )}
        </>
      ) : (
        <span />
      )}
    </DashSection>
  );
}
