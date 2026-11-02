'use client';

/**
 * Planner data. Everything comes from what the app already loads (`useApp`:
 * the book, checklist state, team tasks, document requests), the filings
 * register (`useFilings`), personal to-dos (`/api/todos`) and the calendar
 * blocks (`/api/planner/blocks`). The work queue is the live lead queue
 * (`buildInternWorkItems`, the same build `useInternPortfolio` runs for a
 * lead's own Tasks page), run for any lead key — or for the whole book.
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { getItem } from '@/data/checklist';
import { useComplianceFilings } from '@/hooks/use-compliance-filings';
import { useFilings } from '@/lib/use-filings';
import type { FilingRow } from '@/lib/filings';
import { complianceEngagementsForRole } from '@/lib/compliance/incorporation-state';
import { buildInternWorkItems, internAssignedToEngagement, internWorkBoard, internWorkCta, type InternWorkItem } from '@/lib/intern-work';
import { windowForStep } from '@/lib/schedule-windows';
import { areaOf } from '@/lib/client-portal/compliances';
import type { PlannerBlockDto, PlannerBlockInput, PlannerBlockPatch } from '@/lib/planner-blocks';
import { useConsole } from '../../../runtime';
import { stageOf, stepCode } from '../../clients/model';
import { useTodayIso } from '../../today/useToday';
import { fromTask, fromWork, sortPlan, type BoardCol, type PlanItem } from './model';

export const BOOK = '@book';

/** Who a planner is for. */
export type PlannerWho =
  | { mode: 'mgr-me' }
  | { mode: 'lead-me' }
  | { mode: 'mgr-lead'; key: string; profileId?: string | null; name: string; email?: string };

/* ---------------------------------------------------------------- the live work queue, for one key */

export function useWork(key: string) {
  const { engagements, requests, getStateForEngagement } = useApp();
  const mine = useMemo(
    () => (key === BOOK ? engagements : key ? engagements.filter((e) => internAssignedToEngagement(e, key)) : []),
    [engagements, key],
  );
  // The book planner runs the lead build with one stand-in key for every client.
  const keyed = useMemo(() => (key === BOOK ? mine.map((e) => ({ ...e, internId: BOOK, leadIds: undefined }) as Engagement) : mine), [mine, key]);
  const original = useMemo(() => new Map(mine.map((e) => [e.id, e])), [mine]);
  const stateFor = useCallback((e: Engagement) => getStateForEngagement(original.get(e.id) ?? e), [getStateForEngagement, original]);
  const incorporated = useMemo(() => complianceEngagementsForRole('intern', keyed, stateFor), [keyed, stateFor]);
  const filings = useComplianceFilings(incorporated, stateFor);
  const register = useFilings();
  const { filingWindows, rowByKey } = useMemo(() => {
    const filingWindows: Record<string, { from: string; to: string }> = {};
    const rowByKey: Record<string, FilingRow> = {};
    for (const row of register.data?.rows ?? []) {
      const k = `${row.engagementId}:${row.obligationId}:${row.dueDate}:${row.periodLabel ?? ''}`;
      rowByKey[k] = row;
      if (row.windowFrom && row.windowTo) filingWindows[k] = { from: row.windowFrom, to: row.windowTo };
    }
    return { filingWindows, rowByKey };
  }, [register.data]);
  const myRequests = useMemo(() => requests.filter((r) => original.has(r.engagementId)), [requests, original]);
  const work = useMemo(
    () =>
      key
        ? buildInternWorkItems({ engagements: keyed, getChecklistState: stateFor, internId: key, filings, filingWindows, requests: myRequests })
        : [],
    [key, keyed, stateFor, filings, filingWindows, myRequests],
  );
  return { work, engagements: mine, filings, filingWindows, rowByKey, registerLoading: register.isLoading };
}

/* ---------------------------------------------------------------- plan items */

export function leadKeyOf(e: Pick<Engagement, 'internId' | 'leadIds'>): string | undefined {
  return e.internId?.trim() || e.leadIds?.[0] || undefined;
}

export interface PlanData {
  /** Everything this planner shows (timeline, calendar, list). */
  items: PlanItem[];
  /** The board adds, for the manager's own planner, the book's overdue and due-this-week work. */
  boardItems: PlanItem[];
  /** Every work-queue row in scope for this planner's key (the whole book on My work). */
  all: PlanItem[];
  /** Work waiting on a client (the to-do column's "Waiting on client"). */
  waiting: PlanItem[];
  engagements: Engagement[];
  byClient: Record<string, Engagement>;
  rowByKey: Record<string, FilingRow>;
  loading: boolean;
  today: string;
}

export function usePlan(who: PlannerWho): PlanData {
  const { user, tasks, engagementsSettled, getStateForEngagement } = useApp();
  const { scope, seat } = useConsole();
  const today = useTodayIso();
  const key = who.mode === 'mgr-me' ? BOOK : who.mode === 'lead-me' ? user?.internId ?? '' : who.key;
  const { work, engagements, filings, filingWindows, rowByKey, registerLoading } = useWork(key);
  const byClient = useMemo(() => Object.fromEntries(engagements.map((e) => [e.id, e])), [engagements]);
  const ownerProfile = who.mode === 'mgr-lead' ? who.profileId ?? null : user?.id ?? null;

  return useMemo(() => {
    const inScope = (engagementId: string) => {
      const e = byClient[engagementId];
      return !!e && (scope === 'all' || stageOf(e, getStateForEngagement(e)) === scope);
    };
    const cols = internWorkBoard(work, new Date());
    const colOf = new Map<string, BoardCol>();
    for (const [c, list] of Object.entries(cols)) for (const w of list) colOf.set(w.id, c as BoardCol);
    const filingById = new Map(filings.map((f) => [f.id, f]));
    const ctx = {
      today,
      seat: seat === 'lead' ? ('lead' as const) : ('mgr' as const),
      stepTitle: (id: string) => getItem(id)?.title ?? id,
      stepCode,
      lockFor: (w: InternWorkItem) => {
        if (w.source === 'step' && w.catalogId) {
          const win = windowForStep(byClient[w.engagementId]?.schedule, w.catalogId);
          return win ? { from: win.from, to: win.to, setBy: win.setBy } : undefined;
        }
        if (w.source === 'filing' && w.filingId) return filingWindows[w.filingId];
        return undefined;
      },
      areaForFiling: (id: string) => {
        const f = filingById.get(id);
        return f ? areaOf(f.authority) : ('MCA' as const);
      },
      board: (w: InternWorkItem) => colOf.get(w.id) ?? 'progress',
      cta: internWorkCta,
      leadOf: (id: string) => (byClient[id] ? leadKeyOf(byClient[id]!) : undefined),
    };
    const all = work.filter((w) => inScope(w.engagementId)).map((w) => fromWork(w, ctx));
    const myTasks = ownerProfile
      ? tasks
          .filter((t) => t.assigneeId === ownerProfile && inScope(t.engagementId))
          .map((t) => fromTask(t, byClient[t.engagementId]?.companyName ?? 'Client', today, byClient[t.engagementId] ? leadKeyOf(byClient[t.engagementId]!) : undefined))
      : [];
    // The manager's own planner: the dates they set, what waits on them, their own tasks.
    const mine = who.mode === 'mgr-me' ? all.filter((i) => i.locked || i.work?.kind === 'waiting-manager') : all;
    const items = [...mine, ...myTasks].sort(sortPlan);
    const ids = new Set(items.map((i) => i.id));
    const boardItems =
      who.mode === 'mgr-me' ? [...items, ...all.filter((i) => !ids.has(i.id) && (i.st === 'over' || i.st === 'due'))] : items;
    return {
      items,
      boardItems,
      all,
      waiting: all.filter((i) => i.st === 'wait' && i.holder === 'client').sort(sortPlan),
      engagements,
      byClient,
      rowByKey,
      loading: !engagementsSettled || registerLoading,
      today,
    };
  }, [work, filings, filingWindows, byClient, scope, seat, today, getStateForEngagement, tasks, ownerProfile, who.mode, engagements, rowByKey, engagementsSettled, registerLoading]);
}

/* ---------------------------------------------------------------- calendar blocks */

async function json<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'The calendar could not be saved. Try again.');
  return data;
}

export function useBlocks(ownerId: string | null | undefined, from: string, to: string) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['planner-blocks', ownerId, from, to],
    queryFn: async () =>
      (await json<{ blocks: PlannerBlockDto[] }>(await fetch(`/api/planner/blocks?owner=${encodeURIComponent(ownerId ?? '')}&from=${from}&to=${to}`))).blocks,
    enabled: Boolean(ownerId),
    staleTime: 30_000,
  });
  const done = () => qc.invalidateQueries({ queryKey: ['planner-blocks'] });
  const create = useMutation({
    mutationFn: async (blocks: PlannerBlockInput[]) =>
      (await json<{ blocks: PlannerBlockDto[] }>(await fetch('/api/planner/blocks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks }) }))).blocks,
    onSettled: done,
  });
  const patch = useMutation({
    mutationFn: async ({ id, p }: { id: string; p: PlannerBlockPatch }) =>
      (await json<{ block: PlannerBlockDto }>(await fetch(`/api/planner/blocks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) }))).block,
    onMutate: ({ id, p }) => {
      // Move the block at once; the refetch settles it.
      qc.setQueriesData<PlannerBlockDto[]>({ queryKey: ['planner-blocks'] }, (old) => old?.map((b) => (b.id === id ? { ...b, ...p } : b)));
    },
    onSettled: done,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => json<{ ok: boolean }>(await fetch(`/api/planner/blocks/${id}`, { method: 'DELETE' })),
    onSettled: done,
  });
  return { blocks: q.data ?? [], loading: q.isLoading, error: q.isError, create, patch, remove };
}

/* ---------------------------------------------------------------- the manager's leads (book + roster) */

export interface LeadRow {
  key: string;
  profileId: string | null;
  name: string;
  email: string;
  /** On this manager's roster (reports to them, or to nobody): email change / delete allowed. */
  roster: boolean;
}

export interface RosterRow {
  id: string;
  profileId: string;
  name: string;
  email: string;
  reportsToManagerId?: string | null;
}

/** Same key and shape as the live People page's roster read. */
export function useRoster(enabled = true) {
  return useQuery({
    queryKey: ['admin-interns'],
    queryFn: async () => (await json<{ interns: RosterRow[] }>(await fetch('/api/admin/interns'))).interns,
    enabled,
    staleTime: 60_000,
  });
}

export function useBookLeadRows() {
  const { user } = useApp();
  return useQuery({
    queryKey: ['book-leads', user?.id],
    queryFn: async () => (await json<{ leads: Array<{ internId: string; profileId: string | null; name: string; email?: string }> }>(await fetch('/api/engagements/leads'))).leads,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

/** Every lead the manager works with: the book's leads plus the roster (a new lead has no client yet). */
export function useLeadRows(): { leads: LeadRow[]; loading: boolean; error: boolean; retry: () => void } {
  const roster = useRoster();
  const book = useBookLeadRows();
  const leads = useMemo(() => {
    const map = new Map<string, LeadRow>();
    for (const r of roster.data ?? []) map.set(r.id, { key: r.id, profileId: r.profileId, name: r.name, email: r.email, roster: true });
    for (const l of book.data ?? []) {
      const cur = map.get(l.internId);
      if (cur) map.set(l.internId, { ...cur, profileId: cur.profileId ?? l.profileId, email: cur.email || l.email || '' });
      else map.set(l.internId, { key: l.internId, profileId: l.profileId, name: l.name, email: l.email ?? '', roster: false });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [roster.data, book.data]);
  return {
    leads,
    loading: roster.isLoading || book.isLoading,
    error: roster.isError && book.isError,
    retry: () => {
      void roster.refetch();
      void book.refetch();
    },
  };
}
