'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemSessionsPayload, WorkSessionDto } from '@/lib/work/sessions';
import type { PlannerBlock } from '@/lib/work/planner';
import type { WindowRequestDto, WindowRequestStatus } from '@/lib/work/window-requests';
import type { WorkActivityEntry } from '@/lib/work/item-activity';

/**
 * React Query hooks for the work routes under `/api/work/**` (task drawer, planner and
 * the Approvals date-change section). Views never touch `db`; each hook calls a route
 * that runs its repository under the caller's `AuthContext`.
 */

export interface WorkItemFileDto {
  id: string;
  source: 'document' | 'proof' | 'request';
  fileName: string;
  at: string;
  urlRoute: string;
}

export type WorkCompletionDto =
  | { mode: 'done' }
  | { mode: 'locked'; message: string }
  | { mode: 'form'; reason: string }
  | { mode: 'direct'; canComplete: boolean; missing: number }
  | { mode: 'request'; canComplete: boolean; status: string }
  | { mode: 'none' };

export interface WorkItemDetailDto {
  key: string;
  engagementId: string;
  files: WorkItemFileDto[];
  activity: WorkActivityEntry[];
  completion: WorkCompletionDto;
  window: { from: string; to: string } | null;
}

export interface WorkChecklistItem {
  id: string;
  itemKey: string;
  label: string;
  done: boolean;
  position: number;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...(init.headers ?? {}) } : init?.headers,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'request_failed');
  return data;
}

const k = {
  detail: (key: string) => ['work', 'detail', key] as const,
  sessions: (key: string) => ['work', 'sessions', key] as const,
  running: ['work', 'sessions', 'running'] as const,
  checklist: (key: string) => ['work', 'checklist', key] as const,
  blocks: (from: string, to: string) => ['work', 'blocks', from, to] as const,
  requests: (status: string, key?: string) => ['work', 'window-requests', status, key ?? 'all'] as const,
};

/* ------------------------------------------------------------------ detail */

export function useWorkItemDetail(key: string | null) {
  return useQuery({
    queryKey: k.detail(key ?? ''),
    queryFn: async () => (await call<{ detail: WorkItemDetailDto }>(`/api/work/items?key=${encodeURIComponent(key!)}`)).detail,
    enabled: Boolean(key),
    staleTime: 15_000,
  });
}

/* ---------------------------------------------------------------- sessions */

export function useItemSessions(key: string | null) {
  return useQuery({
    queryKey: k.sessions(key ?? ''),
    queryFn: () => call<ItemSessionsPayload>(`/api/work/sessions?key=${encodeURIComponent(key!)}`),
    enabled: Boolean(key),
    staleTime: 15_000,
  });
}

export function useRunningSession(enabled = true) {
  return useQuery({
    queryKey: k.running,
    queryFn: async () => (await call<{ running: WorkSessionDto | null }>('/api/work/sessions?running=1')).running,
    enabled,
    staleTime: 30_000,
  });
}

export function useSessionToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; running: WorkSessionDto | null }) => {
      if (input.running) {
        return (
          await call<{ session: WorkSessionDto }>(`/api/work/sessions/${input.running.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: 'stop' }),
          })
        ).session;
      }
      return (
        await call<{ session: WorkSessionDto }>('/api/work/sessions', {
          method: 'POST',
          body: JSON.stringify({ key: input.key }),
        })
      ).session;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['work', 'sessions'] });
      void qc.invalidateQueries({ queryKey: ['work', 'detail'] });
    },
  });
}

/* --------------------------------------------------------------- checklist */

export function useWorkChecklist(key: string | null) {
  return useQuery({
    queryKey: k.checklist(key ?? ''),
    queryFn: async () =>
      (await call<{ items: WorkChecklistItem[] }>(`/api/work/checklist?key=${encodeURIComponent(key!)}`)).items,
    enabled: Boolean(key),
    staleTime: 15_000,
  });
}

export function useWorkChecklistActions(key: string) {
  const qc = useQueryClient();
  const queryKey = k.checklist(key);
  const set = (fn: (items: WorkChecklistItem[]) => WorkChecklistItem[]) =>
    qc.setQueryData<WorkChecklistItem[]>(queryKey, (prev) => fn(prev ?? []));
  const refresh = () => void qc.invalidateQueries({ queryKey });

  const add = useMutation({
    mutationFn: async (label: string) =>
      (await call<{ item: WorkChecklistItem }>('/api/work/checklist', { method: 'POST', body: JSON.stringify({ key, label }) }))
        .item,
    onSuccess: (item) => set((items) => [...items, item]),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: async (input: { id: string; done?: boolean; label?: string }) =>
      (
        await call<{ item: WorkChecklistItem }>(`/api/work/checklist/${input.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ done: input.done, label: input.label }),
        })
      ).item,
    onMutate: (input) => set((items) => items.map((i) => (i.id === input.id ? { ...i, ...input } : i))),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => call<{ ok: true }>(`/api/work/checklist/${id}`, { method: 'DELETE' }),
    onMutate: (id) => set((items) => items.filter((i) => i.id !== id)),
    onSettled: refresh,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) =>
      call<{ items: WorkChecklistItem[] }>('/api/work/checklist/order', { method: 'PUT', body: JSON.stringify({ key, ids }) }),
    onMutate: (ids) =>
      set((items) => {
        const byId = new Map(items.map((i) => [i.id, i]));
        return ids.map((id, position) => ({ ...byId.get(id)!, position })).filter((i) => i.id);
      }),
    onSettled: refresh,
  });
  return { add, update, remove, reorder };
}

/* ------------------------------------------------------------- time blocks */

export function useTimeBlocks(range: { from: string; to: string }) {
  return useQuery({
    queryKey: k.blocks(range.from, range.to),
    queryFn: async () =>
      (
        await call<{ blocks: PlannerBlock[] }>(
          `/api/work/time-blocks?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
        )
      ).blocks,
    staleTime: 15_000,
  });
}

export interface BlockDraft {
  itemKey?: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
}

export function useTimeBlockActions() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['work', 'blocks'] });
  const create = useMutation({
    mutationFn: async (blocks: BlockDraft[]) =>
      (await call<{ blocks: PlannerBlock[] }>('/api/work/time-blocks', { method: 'POST', body: JSON.stringify({ blocks }) }))
        .blocks,
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: async (input: { id: string } & Partial<BlockDraft>) => {
      const { id, ...patch } = input;
      return (
        await call<{ block: PlannerBlock }>(`/api/work/time-blocks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
      ).block;
    },
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => call<{ ok: true }>(`/api/work/time-blocks/${id}`, { method: 'DELETE' }),
    onSettled: refresh,
  });
  return { create, update, remove };
}

/* --------------------------------------------------------- window requests */

export function useWindowRequests(status: WindowRequestStatus | 'all', key?: string | null, enabled = true) {
  return useQuery({
    queryKey: k.requests(status, key ?? undefined),
    queryFn: async () => {
      const params = new URLSearchParams({ status });
      if (key) params.set('key', key);
      return (await call<{ requests: WindowRequestDto[] }>(`/api/work/window-requests?${params}`)).requests;
    },
    enabled,
    staleTime: 15_000,
  });
}

export function useWindowRequestActions() {
  const qc = useQueryClient();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['work', 'window-requests'] });
    void qc.invalidateQueries({ queryKey: ['work', 'detail'] });
    void qc.invalidateQueries({ queryKey: ['engagements'] });
    void qc.invalidateQueries({ queryKey: ['filings'] });
  };
  const create = useMutation({
    mutationFn: (input: { itemKey: string; fromDate?: string | null; toDate: string; reason: string }) =>
      call<{ request: { id: string } }>('/api/work/window-requests', { method: 'POST', body: JSON.stringify(input) }),
    onSettled: refresh,
  });
  const act = useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'reject' | 'withdraw'; note?: string }) =>
      call<{ request: { id: string; status: string } }>(`/api/work/window-requests/${input.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: input.action, note: input.note }),
      }),
    onSettled: refresh,
  });
  return { create, act };
}

/** Fetch a same-origin route that returns `{ url }` and open the signed link. */
export async function openSignedFile(urlRoute: string): Promise<void> {
  const data = await call<{ url?: string }>(urlRoute);
  if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
}
