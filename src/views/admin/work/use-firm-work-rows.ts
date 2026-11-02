'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { useComplianceFilings } from '@/hooks/use-compliance-filings';
import { buildTeamTaskRows, type TeamTaskRow } from '@/components/staff/today/today-rows';

/**
 * Firm-wide work items for the admin's Work tabs (G-18). Built with `buildTeamTaskRows`, the
 * same item builder behind the manager's Team tasks and each lead's own Work list, over every
 * engagement the admin can see, so the three screens always agree.
 */

export type ManagerOption = { id: string; name: string; email: string };

export type FirmWorkRow = TeamTaskRow & {
  /** The engagement's manager (`manager_id`, else the legacy `admin_id`); empty when none. */
  managerId: string;
  managerName: string;
};

async function fetchManagers(): Promise<ManagerOption[]> {
  const res = await fetch('/api/admin/managers');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return (body.managers ?? []) as ManagerOption[];
}

export function useFirmWorkRows() {
  const { engagements, requests, tasks, teamMembers, getStateForEngagement, engagementsLoading } = useApp();
  const filings = useComplianceFilings(engagements, getStateForEngagement);
  const managersQuery = useQuery({ queryKey: ['admin-managers'], queryFn: fetchManagers, staleTime: 5 * 60_000 });
  const now = useMemo(() => new Date(), []);

  const rows = useMemo((): FirmWorkRow[] => {
    const managerOf = new Map(engagements.map((e) => [e.id, e.managerId ?? e.adminId ?? '']));
    const managers = managersQuery.data ?? [];
    const nameOf = (id: string) => (id ? (managers.find((m) => m.id === id)?.name ?? 'Project manager') : 'No manager');
    return buildTeamTaskRows({
      engagements,
      getState: getStateForEngagement,
      filings,
      requests,
      tasks,
      leads: teamMembers,
      projectBase: '/app/admin',
      now,
    }).map((row) => {
      const managerId = managerOf.get(row.engagementId) ?? '';
      return { ...row, managerId, managerName: nameOf(managerId) };
    });
  }, [engagements, getStateForEngagement, filings, requests, tasks, teamMembers, managersQuery.data, now]);

  return { rows, teamMembers, loading: engagementsLoading };
}
