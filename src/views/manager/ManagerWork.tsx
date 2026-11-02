'use client';

import { Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { WorkScreen } from '@/views/intern/MyWork';
import { useTeamWork } from '@/views/manager/use-team-work';

/**
 * Manager Work (prototype `WorkScreen` for the manager, S-231 to S-238): the same page as the
 * lead's Work, over the project leads' items on the manager's engagements. The list adds the
 * Lead and Area columns, the Lead filter, bulk Assign and row Reassign; the board shows each
 * card's lead; the drawer names the owner and marks "Pending with me" on items that wait on
 * the manager. The Planner is the manager's own calendar and to-dos, and a pinned to-do can be
 * handed to a project lead. Tasks assigned to the manager themself (an admin's "Assign a task"
 * on the Managers page) join the list as the manager's own rows.
 */
function ManagerWorkInner() {
  const { user } = useApp();
  const me = user?.id ? [{ profileId: user.id, name: user.name ?? 'Me' }] : undefined;
  const work = useTeamWork({ projectBase: '/app/manager', owners: me });
  return (
    <WorkScreen
      workItems={work.items}
      kpis={work.kpis}
      engagements={work.engagements}
      path="/app/manager/work"
      team={work.team(true, user?.id)}
      seo={{ title: 'Work — VCFO Suite', description: "Your project leads' steps, filings and tasks.", path: '/app/manager/work' }}
    />
  );
}

export default function ManagerWork() {
  return (
    <Suspense fallback={<div className="text-[15px] text-ink-muted">Work</div>}>
      <ManagerWorkInner />
    </Suspense>
  );
}
