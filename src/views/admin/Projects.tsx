"use client";

import { Suspense, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { ProjectsView } from '@/views/admin/ProjectsSections';
import { deriveStuckReason } from '@/lib/projects/project-stuck';
import { internCompanyPhaseProgress } from '@/lib/intern/intern-work';
import { engagementChangedAt } from '@/components/staff/today/today-rows';
import { clientRowFacts } from '@/views/admin/clients/client-row';

type View = 'table' | 'board';

export default function Projects() {
  // The list reads `?view=` (a saved view from a home card tile), so it sits under Suspense.
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  );
}

function ProjectsInner() {
  const {
    engagements, tasks, teamMembers, internOptions, engagementsLoading,
    getStateForEngagement,
  } = useApp();
  const router = useRouter();
  const owners = internOptions.length ? internOptions : teamMembers;
  const [view, setView] = useState<View>('table');

  // Every client shows, incorporating and compliance (prototype Clients); the stage tabs split them.
  const enriched = useMemo(() => engagements
    .map((e) => {
      const eTasks = tasks.filter((t) => t.engagementId === e.id);
      const done = eTasks.filter((t) => t.status === 'completed').length;
      const pct = eTasks.length ? Math.round((done / eTasks.length) * 100) : 0;
      const leadIds =
        e.leadIds && e.leadIds.length > 0
          ? e.leadIds
          : e.internId?.trim()
            ? [e.internId]
            : [];
      const leads = leadIds
        .map(
          (id) =>
            owners.find((t) => t.id === id) ?? teamMembers.find((t) => t.id === id),
        )
        .filter(Boolean) as Array<{ id: string; name: string; initials?: string }>;
      const state = getStateForEngagement(e);
      const progress = internCompanyPhaseProgress(e, state);
      return {
        e,
        pct,
        phases: progress.phases.map((p) => ({ done: p.done, total: p.total, title: p.title })),
        changedAt: engagementChangedAt(state),
        done,
        total: eTasks.length,
        intern: leads[0],
        leads,
        stuck: deriveStuckReason(e, state),
        facts: clientRowFacts(e, state),
      };
    }), [engagements, tasks, teamMembers, owners, getStateForEngagement]);

  return (
    <ProjectsView
      engagements={engagements}
      teamMembers={teamMembers}
      internOptions={internOptions}
      engagementsLoading={engagementsLoading}
      router={router}
      view={view}
      setView={setView}
      enriched={enriched}
    />
  );
}
