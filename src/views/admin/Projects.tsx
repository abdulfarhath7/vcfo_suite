"use client";

import { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import { ProjectsView } from '@/views/admin/ProjectsSections';
import { deriveStuckReason } from '@/lib/project-stuck';

const CITIES: Array<{ name: string; x: number; y: number }> = [
  { name: 'Bengaluru', x: 360, y: 470 },
  { name: 'Mumbai',    x: 230, y: 360 },
  { name: 'Delhi NCR', x: 330, y: 150 },
  { name: 'Hyderabad', x: 380, y: 400 },
  { name: 'Pune',      x: 270, y: 380 },
  { name: 'Chennai',   x: 420, y: 510 },
  { name: 'Gurgaon',   x: 320, y: 160 },
  { name: 'Kolkata',   x: 550, y: 290 },
];

function cityFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CITIES[h % CITIES.length];
}

type View = 'table' | 'board';

export default function Projects() {
  const {
    engagements, tasks, teamMembers, internOptions, engagementsLoading,
    getStateForEngagement,
  } = useApp();
  const router = useRouter();
  const owners = internOptions.length ? internOptions : teamMembers;
  const [view, setView] = useState<View>('table');

  const enriched = useMemo(() => engagements
    .filter((e) => e.stage !== 'Operational Readiness')
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
      return {
        e,
        pct,
        done,
        total: eTasks.length,
        intern: leads[0],
        leads,
        city: cityFor(e.id),
        stuck: deriveStuckReason(e, getStateForEngagement(e)),
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
