'use client';

import { memo } from 'react';
import { ClientTeamCard } from '@/components/client/overview/ClientTeamCard';
import { useClientOverview } from '@/hooks/use-client-overview';

/** Client sidebar slot: the assigned PM and lead, from the dashboard's own read. */
export const SidebarClientTeam = memo(function SidebarClientTeam({
  expanded,
}: {
  expanded: boolean;
  /** Kept for callers that still pass it; the card no longer tints by sidebar ink. */
  ink?: 'light' | 'dark';
}) {
  const { data } = useClientOverview();
  const overview = data?.overview;
  if (!expanded || !overview) return null;

  return (
    <ClientTeamCard team={overview.team} companyName={overview.engagement.companyName} />
  );
});
