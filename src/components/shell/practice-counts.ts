'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { isIncorporated } from '@/lib/compliance/incorporation-state';
import type { Role } from '@/lib/auth';

/**
 * R-51 counts on the practice block, only where a real number is already cheap:
 *
 * - Incorporation: the clients still incorporating, counted in memory from the scoped
 *   engagements the shell already holds (`isIncorporated`, the one source of that flag).
 *   Lead, manager and admin, as in the prototype.
 * - Compliances: overdue plus due-soon items from `/api/compliances/counts` (the scoped count
 *   behind the category switch, statutory and non-statutory). Lead and manager only. The range
 *   opens far back so an overdue item from an earlier year still counts, and ends a year ahead
 *   so every due-soon window fits.
 *
 * Registrations has no count: no cheap scoped "pending" number exists, and a guessed one is
 * worse than none.
 */

export function incorporatingCountFor<T extends Parameters<typeof isIncorporated>[0] & object>(
  engagements: readonly T[],
  stateFor: (engagement: T) => Parameters<typeof isIncorporated>[1] | undefined,
): number {
  return engagements.filter((e) => !isIncorporated(e, stateFor(e) ?? null)).length;
}

export function showsIncorporationCount(role: Role | undefined): boolean {
  return role === 'intern' || role === 'manager' || role === 'admin';
}

export function showsComplianceCount(role: Role | undefined): boolean {
  return role === 'intern' || role === 'manager';
}

export function useIncorporatingCount(role: Role | undefined): number {
  const { engagements, getStateForEngagement } = useApp();
  return useMemo(
    () => (showsIncorporationCount(role) ? incorporatingCountFor(engagements, getStateForEngagement) : 0),
    [role, engagements, getStateForEngagement],
  );
}

function ymdOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function useComplianceDueCount(role: Role | undefined): number {
  const enabled = showsComplianceCount(role);
  const q = useQuery({
    queryKey: ['shell', 'compliance-due-count', role],
    queryFn: async (): Promise<number> => {
      const res = await fetch(`/api/compliances/counts?from=2000-01-01&to=${ymdOffset(366)}`);
      if (!res.ok) return 0;
      const data = (await res.json()) as { all?: { overdue?: number; dueSoon?: number } };
      return (data.all?.overdue ?? 0) + (data.all?.dueSoon ?? 0);
    },
    enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  return enabled ? (q.data ?? 0) : 0;
}
