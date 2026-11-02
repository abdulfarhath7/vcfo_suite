'use client';

/**
 * Data for Approvals and Date requests, and the two sidebar badges. Every
 * decision calls exactly what the live views call, so the server sends the
 * same emails and bells and the browser opens the same compose window:
 *
 *   board resolution  approveBoardResolutionInDb (finalize) / reviewChecklistItem(reject, note)
 *                     then refreshEngagementChecklist + doc-pack   (ManagerBoardResolutionReview)
 *   lead / client     reviewChecklistItem(accept | reject, note?)   (ChecklistReviewActions)
 *   send to client    setClientFillRequest(approve | decline, note?) (RequestClientFill)
 *   timeline request  POST /api/engagements/:id/timeline-requests/:rid (TimelineRequestsPanel)
 *   change request    decideChangeRequestInDb(id, 'cancelled')    (ProjectChangeRequestsPanel, manager)
 */
import { useMemo } from 'react';
import { useIsFetching, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { usePendingApprovals } from '@/hooks/use-pending-approvals';
import { approveBoardResolutionInDb } from '@/lib/engagements-db';
import type { TimelineRequestDto } from '@/lib/client-home';
import type { BookTimelineRequest } from '@/lib/timeline-request-history';
import { useConsole, useConsoleBadge } from '../../runtime';
import { useBookLeads, useTodayIso } from '../today/useToday';
import { usePeople } from '../clients/shared';
import { buildApprovals, buildDateRequests, countPendingTimelineRequests, type ApKind } from './model';

/* ---------------------------------------------------------------- the book has landed */

/** The engagements and their checklist index are in (before that every list reads empty). */
export function useBookState(): { loading: boolean; error: boolean; retry: () => void } {
  const { user, engagements, engagementsSettled } = useApp();
  const qc = useQueryClient();
  useIsFetching({ queryKey: ['checklist-index', user?.id] });
  const qs = qc.getQueryCache().findAll({ queryKey: ['checklist-index', user?.id] });
  const settled = qs.some((q) => q.state.data !== undefined || q.state.status === 'error');
  const error = qs.some((q) => q.state.status === 'error' && q.state.data === undefined);
  return {
    loading: !engagementsSettled || (engagements.length > 0 && !settled),
    error,
    retry: () => void qc.invalidateQueries({ queryKey: ['checklist-index', user?.id] }),
  };
}

/** Lead names for the whole book (GET /api/engagements/leads), then the roster. */
function usePeopleNames(): { id: string; name: string }[] {
  const roster = usePeople();
  const leads = useBookLeads();
  return useMemo(() => {
    const out = new Map<string, string>();
    for (const l of leads.data ?? []) if (l.internId && l.name) out.set(l.internId, l.name);
    for (const p of roster) if (!out.has(p.id)) out.set(p.id, p.name);
    return [...out].map(([id, name]) => ({ id, name }));
  }, [leads.data, roster]);
}

/* ---------------------------------------------------------------- approvals */

export function useApprovals() {
  const { engagements, getStateForEngagement, user } = useApp();
  const { scope } = useConsole();
  const rows = usePendingApprovals('manager');
  const people = usePeopleNames();
  const today = useTodayIso();
  const book = useBookState();
  const model = useMemo(
    () =>
      buildApprovals({
        rows,
        engagements,
        stateFor: getStateForEngagement,
        people,
        me: user ? { id: user.id, role: user.role } : undefined,
        today,
        scope,
      }),
    [rows, engagements, getStateForEngagement, people, user, today, scope],
  );
  return { model, book, today };
}

/** Sidebar badge: every step waiting on this manager across the book — Today's source, so the counts agree. */
export function useApprovalsBadge() {
  const n = usePendingApprovals('manager').length;
  useConsoleBadge('approvals', n, 'hot');
}

export interface DecideDeps {
  reviewChecklistItem: ReturnType<typeof useApp>['reviewChecklistItem'];
  setClientFillRequest: ReturnType<typeof useApp>['setClientFillRequest'];
  refreshEngagementChecklist: ReturnType<typeof useApp>['refreshEngagementChecklist'];
  qc: QueryClient;
}

export function useDecideDeps(): DecideDeps {
  const { reviewChecklistItem, setClientFillRequest, refreshEngagementChecklist } = useApp();
  const qc = useQueryClient();
  return { reviewChecklistItem, setClientFillRequest, refreshEngagementChecklist, qc };
}

/** One decision, the live way. Resolves with the confirmation to show; throws with the reason. */
export async function decideApproval(
  d: DecideDeps,
  item: { kind: ApKind; engagementId: string; itemId: string; title: string },
  yes: boolean,
  note?: string,
): Promise<string> {
  const { kind, engagementId: id, itemId, title } = item;
  const clean = note?.trim() || undefined;
  if (kind === 'board') {
    if (yes) await approveBoardResolutionInDb(id);
    else {
      if (!clean) throw new Error('Add a note so the project lead knows what to change.');
      await d.reviewChecklistItem(id, 'pre-2', 'reject', clean);
    }
    await d.refreshEngagementChecklist(id);
    void d.qc.invalidateQueries({ queryKey: ['doc-pack', id] });
    return yes ? 'Board resolution approved · the client can now download, sign and upload it' : 'Sent back to the project lead';
  }
  if (kind === 'fill') {
    await d.setClientFillRequest(id, itemId, yes ? 'approve' : 'decline', yes ? undefined : clean);
    return yes ? `Request sent to the client · ${title} was emailed from your mailbox with a link to the step` : 'Request declined · nothing was sent to the client';
  }
  await d.reviewChecklistItem(id, itemId, yes ? 'accept' : 'reject', yes ? undefined : clean);
  return yes
    ? `${title} accepted · send the client email (admin and lead are on CC)`
    : `${title} rejected · the client can update the reopened fields and submit again`;
}

/* ---------------------------------------------------------------- date requests */

/** Per-engagement timeline requests — same key and reader as Today's gate and the client overview, so one cache. */
export function useTimelineLists(ids: string[]) {
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['timeline-requests', id],
      queryFn: async (): Promise<TimelineRequestDto[]> => {
        const res = await fetch(`/api/engagements/${encodeURIComponent(id)}/timeline-requests`);
        if (!res.ok) return [];
        return ((await res.json()) as { requests: TimelineRequestDto[] }).requests;
      },
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  });
  const lists: Record<string, TimelineRequestDto[] | undefined> = {};
  ids.forEach((id, i) => {
    lists[id] = results[i]?.data;
  });
  return {
    lists,
    loading: results.some((r) => r.isPending),
    error: results.some((r) => r.isError),
    retry: () => results.forEach((r) => (r.isError ? void r.refetch() : undefined)),
  };
}

export const CLOSED_KEY = ['timeline-requests-closed'] as const;

export function useDateRequests() {
  const { engagements, getStateForEngagement, user } = useApp();
  const { scope } = useConsole();
  const today = useTodayIso();
  const ids = useMemo(() => engagements.map((e) => e.id), [engagements]);
  const t = useTimelineLists(ids);
  const closed = useQuery({
    queryKey: [...CLOSED_KEY, user?.id],
    queryFn: async (): Promise<BookTimelineRequest[]> => {
      const res = await fetch('/api/timeline-requests?days=30');
      const data = (await res.json().catch(() => ({}))) as { requests?: BookTimelineRequest[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not load the decided requests');
      return data.requests ?? [];
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });
  const listKey = JSON.stringify(ids.map((id) => (t.lists[id] ?? []).map((r) => `${r.id}:${r.status}`)));
  const model = useMemo(
    () =>
      buildDateRequests({
        engagements,
        stateFor: getStateForEngagement,
        lists: t.lists,
        closed: closed.data ?? [],
        meId: user?.id,
        today,
        scope,
      }),
    // `t.lists` is rebuilt each render; `listKey` says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [engagements, getStateForEngagement, listKey, closed.data, user?.id, today, scope],
  );
  return { model, timeline: t, closed, today };
}

/** Sidebar badge: pending client timeline requests across the whole book (not filtered by stage). */
export function useDateRequestsBadge() {
  const { engagements } = useApp();
  const ids = useMemo(() => engagements.map((e) => e.id), [engagements]);
  const { lists } = useTimelineLists(ids);
  useConsoleBadge('requests', countPendingTimelineRequests(lists), 'hot');
}

/** Approve / decline a timeline request (live TimelineRequestsPanel: same route, same optional note). */
export async function decideTimeline(qc: QueryClient, engagementId: string, requestId: string, decision: 'approve' | 'reject', note?: string): Promise<void> {
  const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/timeline-requests/${encodeURIComponent(requestId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decision, note: note?.trim() || undefined }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Could not save the decision');
  void qc.invalidateQueries({ queryKey: ['timeline-requests', engagementId] });
  void qc.invalidateQueries({ queryKey: ['engagements'] });
  void qc.invalidateQueries({ queryKey: CLOSED_KEY });
}
