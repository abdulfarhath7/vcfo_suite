'use client';

/** Nav badge `leads` (prototype mxNavBadge: the number of project leads). */
import { useConsoleBadge } from '../../runtime';
import { useLeadRows } from '../work/planner/data';

export function useLeadsBadge(): void {
  const { leads, loading } = useLeadRows();
  useConsoleBadge('leads', loading ? undefined : leads.length);
}
