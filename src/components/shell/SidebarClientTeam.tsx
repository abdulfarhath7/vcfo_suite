'use client';

import { memo } from 'react';
import { ClientTeamCard } from '@/components/client/overview/ClientTeamCard';
import { useClientOverview } from '@/lib/use-client-overview';

/** Client sidebar slot: the assigned PM and lead, from the dashboard's own read. */
export const SidebarClientTeam = memo(function SidebarClientTeam({
  expanded,
  ink = 'dark',
}: {
  expanded: boolean;
  ink?: 'light' | 'dark';
}) {
  const { data } = useClientOverview();
  const overview = data?.overview;
  if (!expanded || !overview) return null;

  return (
    <ClientTeamCard team={overview.team} companyName={overview.engagement.companyName} ink={ink} />
  );
});
