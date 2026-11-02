'use client';

/**
 * The data behind Today and the manager's sidebar extras. Everything comes
 * from what the app already loads for a signed-in manager (`useApp`: the book,
 * checklist state, team tasks, document requests), the filings register
 * (`useFilings` — the same query the Filings register and Calendar read), the
 * approvals inbox hook (the same list the Approvals page shows) and the book's
 * project leads (`/api/engagements/leads`). One pure builder (`model.ts`)
 * turns it into the lists every panel counts from.
 */
import { useEffect, useMemo, useState } from 'react';
import { useIsFetching, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { usePendingApprovals } from '@/hooks/use-pending-approvals';
import { useFilings } from '@/hooks/use-filings';
import { todayIso } from '@/components/portal/dates';
import { useConsole } from '../../runtime';
import { buildToday, type LeadPerson, type TodayModel } from './model';

/** Today's date in India; rolls over at midnight while the page is open. */
export function useTodayIso(): string {
  const [today, setToday] = useState(() => todayIso());
  useEffect(() => {
    const t = window.setInterval(() => setToday(todayIso()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return today;
}

/** Every project lead on the book, with names (one read). */
export function useBookLeads() {
  const { user } = useApp();
  return useQuery({
    queryKey: ['book-leads', user?.id],
    queryFn: async (): Promise<LeadPerson[]> => {
      const res = await fetch('/api/engagements/leads');
      const data = (await res.json().catch(() => ({}))) as { leads?: LeadPerson[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not load the project leads');
      return data.leads ?? [];
    },
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Today's page and the three sidebar extras all read the same model. One
 * entry, keyed on the very objects it was built from, saves building it four
 * times per change; any new input builds it again.
 */
let last: { key: unknown[]; model: TodayModel } | null = null;
function sameKey(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
}

export interface TodayData {
  model: TodayModel;
  /** The book (engagements and their checklist state) has not arrived yet. */
  loading: boolean;
  filings: { loading: boolean; error: boolean; retry: () => void };
  /** Every step waiting on this manager across the book (the Approvals page's list). */
  approvalsAll: number;
}

export function useToday(): TodayData {
  const { user, engagements, engagementsSettled, getStateForEngagement, tasks, requests, teamMembers } = useApp();
  const { scope, seat: consoleSeat, base } = useConsole();
  const seat = consoleSeat === 'lead' ? 'lead' : 'mgr';
  const today = useTodayIso();
  const approvals = usePendingApprovals('manager');
  const filingsQ = useFilings();
  const leadsQ = useBookLeads();

  // The checklist index lands after the book; until then every client would read "step 1".
  // (useIsFetching re-renders this hook when that read starts and ends.)
  useIsFetching({ queryKey: ['checklist-index', user?.id] });
  const qc = useQueryClient();
  const indexSettled = qc
    .getQueryCache()
    .findAll({ queryKey: ['checklist-index', user?.id] })
    .some((q) => q.state.data !== undefined || q.state.status === 'error');

  const people = useMemo<LeadPerson[]>(
    () =>
      (teamMembers ?? []).map((m) => ({
        internId: m.id,
        profileId: (m as typeof m & { profileId?: string }).profileId ?? null,
        name: m.name,
      })),
    [teamMembers],
  );

  const model = useMemo(() => {
    // `approvals` and `people` are derived from `engagements` / state / `teamMembers`, so those stand in for them.
    const key = [today, base, seat, user?.id, scope, engagements, getStateForEngagement, tasks, requests, filingsQ.data, leadsQ.data, teamMembers];
    if (last && sameKey(last.key, key)) return last.model;
    const built = buildToday({
      today,
      base,
      seat,
      meId: user?.id ?? '',
      scope,
      engagements,
      stateFor: getStateForEngagement,
      tasks,
      requests,
      filings: filingsQ.data?.rows ?? [],
      approvals,
      leads: leadsQ.data ?? [],
      people,
    });
    last = { key, model: built };
    return built;
  }, [today, base, seat, user?.id, scope, engagements, getStateForEngagement, tasks, requests, filingsQ.data, approvals, leadsQ.data, people, teamMembers]);

  return {
    model,
    loading: !engagementsSettled || (engagements.length > 0 && !indexSettled) || leadsQ.isLoading,
    filings: { loading: filingsQ.isLoading, error: filingsQ.isError, retry: () => void filingsQ.refetch() },
    approvalsAll: approvals.length,
  };
}

/** Pending client timeline requests on the incorporating clients in view (the "date requests" gate). */
export function usePendingDateRequests(clientIds: string[]): number {
  const results = useQueries({
    queries: clientIds.map((id) => ({
      // Same key and shape as the project page's TimelineRequestsPanel, so the cache is shared.
      queryKey: ['timeline-requests', id],
      queryFn: async () => {
        const res = await fetch(`/api/engagements/${encodeURIComponent(id)}/timeline-requests`);
        if (!res.ok) return [] as Array<{ status: string }>;
        return ((await res.json()) as { requests: Array<{ status: string }> }).requests;
      },
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  });
  return results.reduce((n, r) => n + (r.data ?? []).filter((x) => x.status === 'pending').length, 0);
}
