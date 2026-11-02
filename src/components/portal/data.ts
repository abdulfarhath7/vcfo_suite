'use client';

/**
 * Shared data hooks for the portal. Every section reads the same few lists, and
 * TanStack Query fetches each list once (same query key → one request), so the
 * Home orbit, the Calendar, Filings and Search all share one filings request.
 *
 * Rule of the repo: views never touch `db`. Every hook here calls a
 * `/api/client/*` route, and the route runs the repository under the caller's
 * AuthContext (a client only ever reads their own company).
 *
 * Section-specific reads (credentials, audit, library …) live in the section's
 * own folder; put a hook here only when two or more sections need it.
 */
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { ChecklistItemState } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { findEngagementForClientUser } from '@/lib/checklist/checklist-state-key';
import { buildIncorporationModel, type PortalIncorporationModel } from '@/lib/client-portal/step-model';
import type { PortalFiling } from '@/lib/client-portal/compliances';
import { statutoryFilings } from '@/lib/client-portal/statutory-fallback';
import { projectedWindow } from '@/lib/client-portal/master-plan';
import type { ClientHome } from '@/lib/client/client-home';
import type { ClientDocumentsPayload } from '@/lib/client-portal/documents';
import type { ClientIncorporationExtras } from '@/lib/client-portal/incorporation-types';
import { useClientOverview } from '@/hooks/use-client-overview';
import { fyOf, todayIso } from './dates';

/** Every portal query key starts with this, so `refreshPortal()` can refetch them all. */
export const PK = 'portal' as const;

export const QK = {
  shell: [PK, 'shell'] as const,
  home: [PK, 'home'] as const,
  filings: (fy?: number) => [PK, 'filings', fy ?? 'current'] as const,
  documents: [PK, 'documents'] as const,
  incorporationExtras: [PK, 'incorporation-extras'] as const,
  notifications: [PK, 'notifications'] as const,
  announcementsUnread: [PK, 'announcements-unread'] as const,
};

/** GET helper: JSON body or a thrown Error with the server's message. 404 → null. */
export async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  if (res.status === 404) return null;
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `${url} ${res.status}`);
  return body;
}

/** POST/PATCH/DELETE helper with a JSON body; throws the server's message on failure. */
export async function sendJson<T = unknown>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data;
}

/** Refetch every portal list (after an upload, an approval, a sent form …). */
export function useRefreshPortal(): () => void {
  const qc = useQueryClient();
  const { refreshEngagementChecklist } = useApp();
  const { engagement } = useMyEngagement();
  return () => {
    void qc.invalidateQueries({ queryKey: [PK] });
    void qc.invalidateQueries({ queryKey: ['client-overview'] });
    // the non-statutory tasks and statutory extras (client-portal/pages/compliances/task-api.ts) key off 'client-compliances'
    void qc.invalidateQueries({ queryKey: ['client-compliances'] });
    if (engagement?.id) void refreshEngagementChecklist(engagement.id);
  };
}

/* ---------------------------------------------------------------- engagement + step model */

/**
 * The app context starts from the checklist INDEX (/api/checklist-index: step
 * statuses only). The client's answers (Part B entries, directors, shared
 * drafts, "on record so far" rows) come with the full checklist state, which
 * the previous portal loaded on mount. PortalRoot calls this once, so every
 * section sees the answers on the first visit; `useRefreshPortal()` reloads it
 * after every save or upload.
 */
export function useLoadFullChecklist() {
  const { refreshEngagementChecklist } = useApp();
  const { engagement } = useMyEngagement();
  const engId = engagement?.id;
  useEffect(() => {
    if (engId) void refreshEngagementChecklist(engId);
  }, [engId, refreshEngagementChecklist]);
}

/** The signed-in client's engagement and its (already client-redacted) checklist state. */
export function useMyEngagement(): {
  engagement: Engagement | undefined;
  state: Record<string, ChecklistItemState>;
  loading: boolean;
} {
  const { user, engagements, engagementsSettled, getStateForEngagement } = useApp();
  const engagement = useMemo(
    () => (user ? findEngagementForClientUser(engagements, user) ?? engagements[0] : undefined),
    [user, engagements],
  );
  const state = engagement ? getStateForEngagement(engagement) : {};
  return { engagement, state, loading: !engagementsSettled };
}

/**
 * The incorporation step model (src/lib/client-portal/step-model.ts) for the
 * client's engagement: phases 1–4 (SPICe+ Part A, Part B, Post-incorporation,
 * Registration), every step's kind (done / you / prog / with / next / up),
 * owner, window and lateness. Home, Incorporation, Registrations, Master
 * calendar and Search all read this one model.
 */
export function usePortalIncorporation(): {
  model: PortalIncorporationModel;
  engagement: Engagement | undefined;
  loading: boolean;
} {
  const { engagement, state, loading } = useMyEngagement();
  const today = todayIso();
  const model = useMemo(
    () => buildIncorporationModel(state as never, engagement?.schedule ?? null, today),
    [state, engagement?.schedule, today],
  );
  return { model, engagement, loading };
}

/** /api/client/overview — company, identifiers, team, deliverables (also used by the old dashboard). */
export { useClientOverview };

/** /api/client/incorporation — file requests per step and the board-resolution state. */
export function useIncorporationExtras() {
  const { engagement } = useMyEngagement();
  return useQuery({
    queryKey: QK.incorporationExtras,
    queryFn: async () => (await getJson<{ incorporation: ClientIncorporationExtras }>('/api/client/incorporation'))?.incorporation ?? null,
    enabled: Boolean(engagement),
    staleTime: 30_000,
  });
}

/* ---------------------------------------------------------------- home aggregate */

/** /api/client/home — needs from you, SBC's work items, recent documents, activity, this FY's filings, masked IDs. */
export function useClientHome() {
  return useQuery({
    queryKey: QK.home,
    queryFn: async () => (await getJson<{ home: ClientHome }>('/api/client/home'))?.home ?? null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/* ---------------------------------------------------------------- filings */

/**
 * /api/client/compliances?fy= — the filing register for one financial year
 * (no `fy`: every year on the register). Status of a row: `statusOf(row, today)`
 * from src/lib/client-portal/compliances.ts (ok / due / over / up).
 *
 * When the register has no filings (before incorporation, or before SBC
 * generates it), the rows are SBC's statutory compliance calendar for the year,
 * filtered to this company (src/lib/client-portal/statutory-fallback.ts), each
 * marked `fromCalendar`, and `data.fromCalendar` is true. Those rows are
 * informational: never overdue or filed, no reminder / proof / walkthrough.
 */
export function useFilings(fyStartYear?: number) {
  const { engagement, model } = usePortalIncorporation();
  // when the company exists (or will): the real incorporation date, else SBC's expected one, else the playbook projection
  const existsFrom = useMemo(() => {
    if (!engagement) return undefined;
    const real = engagement.incorporationDate?.slice(0, 10) || (model.byId['pre-12']?.kind === 'done' ? model.byId['pre-12']?.doneOn : undefined);
    if (real) return real;
    if (model.coiExpected) return model.coiExpected;
    const created = engagement.createdAt?.slice(0, 10);
    const firstDone = model.steps.map((s) => s.doneOn).filter((d): d is string => Boolean(d)).sort()[0];
    const base = firstDone && created && firstDone < created ? firstDone : created ?? firstDone;
    const coiStep = model.byId['pre-12'];
    return base && coiStep ? projectedWindow(coiStep.item.deadline, base, undefined)?.[1] : undefined;
  }, [engagement, model]);
  const q = useQuery({
    queryKey: QK.filings(fyStartYear),
    queryFn: async () => {
      const qs = fyStartYear ? `?fy=${fyStartYear}` : '';
      const body = await getJson<{ rows: PortalFiling[]; today: string }>(`/api/client/compliances${qs}`);
      return body ?? { rows: [], today: todayIso() };
    },
    staleTime: 30_000,
  });
  const raw = q.data;
  const data = useMemo(() => {
    if (!raw) return undefined;
    if (raw.rows.length > 0 || !engagement) return { ...raw, fromCalendar: false };
    const fy = fyStartYear ?? fyOf(raw.today).start;
    return { rows: statutoryFilings(engagement, fy, raw.today, existsFrom), today: raw.today, fromCalendar: true };
  }, [raw, engagement, fyStartYear, existsFrom]);
  return { ...q, data };
}

/* ---------------------------------------------------------------- documents */

/** /api/client/documents — every file on record, grouped by step and category, plus open requests. */
export function useClientDocuments() {
  return useQuery({
    queryKey: QK.documents,
    queryFn: async () => (await getJson<{ documents: ClientDocumentsPayload }>('/api/client/documents'))?.documents ?? null,
    staleTime: 30_000,
  });
}
