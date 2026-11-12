"use client";

import { Suspense, useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { ProjectsView } from '@/views/admin/ProjectsSections';
import { projectListItems } from '@/lib/projects/project-list-rows';

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
  // The items are built as the server's Excel export builds them (GL-06).
  const enriched = useMemo(
    () => projectListItems(engagements, tasks, owners, teamMembers, getStateForEngagement),
    [engagements, tasks, teamMembers, owners, getStateForEngagement],
  );

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
