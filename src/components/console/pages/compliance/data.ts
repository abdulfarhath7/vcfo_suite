'use client';

/**
 * Data behind the compliance calendar and the filings register: the register
 * for one FY (`useFilings` — the live views' query), the portal read of the
 * same rows (`/api/client/compliances?fy=`: period, proof count, ARN, the
 * caller's reminder — the live staff proof editor reads it too), the roster
 * (`useApp`, lead-gated by `complianceEngagementsForRole` exactly as the live
 * CompliancePages) and the book's leads. Both APIs run the repositories under
 * the caller's AuthContext: a manager sees their book, a lead their clients.
 */
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { useFilings } from '@/hooks/use-filings';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import { complianceEngagementsForRole } from '@/lib/compliance/incorporation-state';
import { canSetScheduleWindows } from '@/lib/projects/schedule-windows';
import { isFirmWideAdmin } from '@/lib/auth';
import { useConsole, useConsoleBadge } from '../../runtime';
import { useBookLeads, useTodayIso } from '../today/useToday';
import { filingSt } from '../today/model';
import { buildBook, taskRows, type Book, type ConsoleTask, type TRow } from './model';

export const portalKey = (fy: number) => ['client-compliances', 'console', fy] as const;

/* ---------------------------------------------------------------- non-statutory tasks (COMPLIANCE-API.md section 2) */

/** Under the key Farhath's task hooks invalidate (`['compliance-tasks', …]`), so a task write anywhere refreshes these pages. */
export const tasksKey = (fy: number) => ['compliance-tasks', 'console', fy] as const;

/** `GET /api/compliances/tasks?from=&to=` — the FY's tasks by END date, under the caller's scope (manager: book; lead: own clients). */
export function useFyTasksQuery(fy: number) {
  return useQuery({
    queryKey: tasksKey(fy),
    queryFn: async (): Promise<ConsoleTask[]> => {
      const res = await fetch(`/api/compliances/tasks?from=${fy}-04-01&to=${fy + 1}-03-31`, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { tasks?: ConsoleTask[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not load the non-statutory tasks');
      return body.tasks ?? [];
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export interface TaskData {
  /** every task of the FY in the Stage filter, as rows on their end date */
  tasks: TRow[];
  loading: boolean;
  error: boolean;
  retry: () => void;
}

/** The FY's tasks as rows, scoped like the book (a task of a client the Stage filter leaves out is dropped). */
export function useFyTasks(fy: number, book: Book): TaskData {
  const q = useFyTasksQuery(fy);
  const tasks = useMemo(() => taskRows(q.data ?? [], book.today, (id) => !book.byId[id] || book.byId[id]!.inScope), [q.data, book.today, book.byId]);
  return { tasks, loading: q.isPending, error: q.isError, retry: () => void q.refetch() };
}

/** F-2: the signed link of a task's deliverable (`GET /api/compliances/tasks/:id/attachments/:attachmentId`). */
export async function taskAttachmentUrl(taskId: string, attachmentId: string): Promise<{ url: string; fileName: string }> {
  const res = await fetch(`/api/compliances/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}`);
  const body = (await res.json().catch(() => ({}))) as { url?: string; fileName?: string; error?: string };
  if (!res.ok || !body.url) throw new Error(body.error === 'not_found' ? 'The file is not in your clients' : body.error ?? 'Could not open the file');
  return { url: body.url, fileName: body.fileName ?? '' };
}

export function usePortalRows(fy: number) {
  return useQuery({
    queryKey: portalKey(fy),
    queryFn: async (): Promise<PortalFiling[]> => {
      const res = await fetch(`/api/client/compliances?fy=${fy}`, { cache: 'no-store' });
      const body = (await res.json().catch(() => ({}))) as { rows?: PortalFiling[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not load the filing details');
      return body.rows ?? [];
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export interface BookData {
  book: Book;
  /** the roster or the register has not arrived yet */
  loading: boolean;
  error: boolean;
  retry: () => void;
  /** manager / admin / super admin: windows, proofs, mark filed (live `canSetScheduleWindows`) */
  mayWrite: boolean;
  firmWide: boolean;
  /** live: a lead with no incorporated client goes to Today */
  leadHasNothing: boolean;
}

/** One built book shared by the page and its open pop-overs (same inputs → same object). */
let last: { key: unknown[]; book: Book } | null = null;

export function useBook(fy: number): BookData {
  const { user, engagements, engagementsSettled, getStateForEngagement } = useApp();
  const { scope } = useConsole();
  const today = useTodayIso();
  const reg = useFilings({ fyStartYear: fy });
  const portal = usePortalRows(fy);
  const leads = useBookLeads();
  const role = user?.role;
  const roster = useMemo(() => complianceEngagementsForRole(role, engagements, getStateForEngagement), [role, engagements, getStateForEngagement]);
  const book = useMemo(() => {
    const key = [today, fy, scope, roster, getStateForEngagement, reg.data, portal.data, leads.data];
    if (last && last.key.length === key.length && last.key.every((x, i) => Object.is(x, key[i]))) return last.book;
    const built = buildBook({
      today,
      fy,
      scope,
      engagements: roster,
      stateFor: getStateForEngagement,
      register: reg.data?.rows ?? [],
      portal: portal.data,
      leads: leads.data,
    });
    last = { key, book: built };
    return built;
  }, [today, fy, scope, roster, getStateForEngagement, reg.data, portal.data, leads.data]);
  return {
    book,
    loading: !engagementsSettled || reg.isPending,
    error: reg.isError,
    retry: () => {
      void reg.refetch();
      void portal.refetch();
    },
    mayWrite: canSetScheduleWindows(role),
    firmWide: isFirmWideAdmin(role),
    leadHasNothing: engagementsSettled && role === 'intern' && roster.length === 0,
  };
}

/** Refetch the register everywhere (Today, the mini calendar, both pages, the proof editor). */
export function useRefreshFilings(): () => void {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['filings'] });
    void qc.invalidateQueries({ queryKey: ['client-compliances'] });
  };
}

async function send(url: string, method: 'POST' | 'DELETE' | 'PATCH', body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

/** Mark filed on a day, or clear it (`null`) — POST /api/filings/:id/filed. */
export const postFiled = (id: string, filedOn: string | null) => send(`/api/filings/${encodeURIComponent(id)}/filed`, 'POST', { filedOn });
/** The caller's own "Remind me" (the client portal's route; due − 3 days, by email). */
export const postReminder = (id: string, on: boolean) =>
  send(`/api/client/compliances/${encodeURIComponent(id)}/reminder`, on ? 'POST' : 'DELETE', on ? { channels: ['email'] } : undefined) as Promise<{ remindOn?: string }>;
export const patchDetails = (id: string, patch: Record<string, string | null>) => send(`/api/client/compliances/${encodeURIComponent(id)}/details`, 'PATCH', patch);
export const deleteProof = (id: string, proofId: string) => send(`/api/client/compliances/${encodeURIComponent(id)}/proofs/${encodeURIComponent(proofId)}`, 'DELETE');

export interface Proof {
  id: string;
  fileName: string;
  kind: string;
  uploadedAt: string;
  uploadedBy?: string | null;
  legacy?: boolean;
}
/** Same key as the live staff proof editor, so either view refreshes the other. */
export function useProofs(id: string, enabled = true) {
  return useQuery({
    queryKey: ['filing-proofs', id],
    queryFn: async (): Promise<Proof[]> => {
      const res = await fetch(`/api/client/compliances/${encodeURIComponent(id)}/proofs`);
      const body = (await res.json().catch(() => ({}))) as { proofs?: Proof[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not load the proofs');
      return body.proofs ?? [];
    },
    enabled,
  });
}

/**
 * Sidebar badges (prototype mxNavBadge): `compliance` = overdue + due this
 * week (tone new), `filings` = overdue (hot). From the whole register (every
 * FY, the query Today and the mini calendar read), not the Stage filter.
 */
export function useComplianceBadges(): void {
  const q = useFilings();
  const today = useTodayIso();
  const { overdue, due } = useMemo(() => {
    let o = 0;
    let d = 0;
    for (const r of q.data?.rows ?? []) {
      const st = filingSt(r, today);
      if (st === 'o') o += 1;
      else if (st === 'd') d += 1;
    }
    return { overdue: o, due: d };
  }, [q.data, today]);
  useConsoleBadge('filings', overdue, 'hot');
  useConsoleBadge('compliance', overdue + due, 'new');
}
