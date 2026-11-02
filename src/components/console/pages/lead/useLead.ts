'use client';

/**
 * Data for the project lead's pages, all from real sources:
 *
 *   useLeadDesk      the shared Today model (seat 'lead') → the lead's desk lists
 *   useLeadReviews   what a lead really reviews: document-request uploads
 *                    (approve / send back through PATCH /api/requests/:id, which
 *                    staff may do) and client file uploads on steps still open
 *                    (GET /api/engagements/:id/file-requests; checked on the step)
 *   useLeadManagers  the managers on the lead's clients, from the same intern-
 *                    scoped directory read the old "My managers" card used
 *   useLeadBadges    nav badges: today (due today or late), reviews, tasks (open)
 */
import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import { resolveLeadManagers, type LeadManager } from '@/lib/intern/lead-managers';
import { useConsoleBadge } from '../../runtime';
import { useToday } from '../today/useToday';
import type { TodayModel } from '../today/model';
import { buildDesk, buildReviews, type FileRequestDto } from './desk';

export function useLeadDesk() {
  const data = useToday();
  const desk = useMemo(() => buildDesk(data.model), [data.model]);
  return { ...data, desk };
}

export type { ReviewItem } from './desk';

export function useLeadReviews(m: TodayModel) {
  const { requests } = useApp();
  const ids = m.clients.map((c) => c.id);
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['lead-file-requests', id],
      queryFn: async (): Promise<FileRequestDto[]> => {
        const res = await fetch(`/api/engagements/${encodeURIComponent(id)}/file-requests`);
        if (!res.ok) return [];
        return ((await res.json()) as { requests?: FileRequestDto[] }).requests ?? [];
      },
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    })),
  });
  const filesKey = results.map((r) => r.dataUpdatedAt).join(',');
  const files = useMemo(() => {
    const o: Record<string, FileRequestDto[]> = {};
    ids.forEach((id, i) => {
      o[id] = results[i]?.data ?? [];
    });
    return o;
    // results change identity every render; their update stamps say when data changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(','), filesKey]);
  const items = useMemo(() => buildReviews(m, requests, files), [m, requests, files]);
  return { items, loading: results.some((r) => r.isLoading) };
}

async function fetchDirectory(): Promise<DirectoryPerson[]> {
  const res = await fetch('/api/outlook/directory');
  const json = (await res.json()) as { people?: DirectoryPerson[]; error?: string };
  if (!res.ok) throw new Error(json.error || 'directory_failed');
  return json.people ?? [];
}

/** Same query key as the old "My managers" card, so the read is shared. */
export function useLeadManagers(m: TodayModel): { managers: LeadManager[]; loading: boolean; error: boolean } {
  const q = useQuery({ queryKey: ['outlook-directory', 'intern-managers'], queryFn: fetchDirectory });
  const managers = useMemo(() => resolveLeadManagers(m.all.map((c) => c.e), q.data ?? []), [m.all, q.data]);
  return { managers, loading: q.isPending, error: q.isError };
}

export function useLeadBadges() {
  const { desk, model, loading } = useLeadDesk();
  const { items } = useLeadReviews(model);
  const open = desk.items.filter((i) => !i.done && i.holder === 'you').length;
  useConsoleBadge('today', loading ? undefined : desk.today.length, 'hot');
  useConsoleBadge('reviews', loading ? undefined : items.length, 'hot');
  useConsoleBadge('tasks', loading ? undefined : open);
}
