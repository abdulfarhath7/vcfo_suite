'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LiveSessionView, ViewerAccess } from '@/lib/live-browser/types';

/**
 * The live browser's Suite routes (`app/api/live-browser/*`). The stream itself is a WebSocket to
 * the broker (`src/views/live-portal/use-live-stream.ts`); these hooks only start, read and stop
 * sessions and fetch the short-lived viewer tokens.
 */

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'request_failed'), { code: data.error ?? 'request_failed', status: res.status });
  return data;
}

const OPEN_POLL_MS = 3_000;

export function useLiveSession(id: string | null | undefined) {
  return useQuery({
    queryKey: ['live-browser-session', id],
    enabled: Boolean(id),
    queryFn: async () => readJson<{ session: LiveSessionView; me: string }>(await fetch(`/api/live-browser/sessions/${id}`, { cache: 'no-store' })),
    refetchInterval: (q) => (q.state.data?.session.open ? OPEN_POLL_MS : false),
  });
}

/** The engagement's sessions for one task, newest first: the card's live preview and "Open again". */
export function useLiveSessions(engagementId: string | null | undefined, taskId?: string) {
  return useQuery({
    queryKey: ['live-browser-sessions', engagementId, taskId ?? null],
    enabled: Boolean(engagementId),
    queryFn: async () =>
      readJson<{ sessions: LiveSessionView[] }>(
        await fetch(`/api/live-browser/sessions?engagementId=${encodeURIComponent(engagementId!)}${taskId ? `&taskId=${encodeURIComponent(taskId)}` : ''}`, { cache: 'no-store' }),
      ),
    refetchInterval: (q) => (q.state.data?.sessions.some((s) => s.open) ? OPEN_POLL_MS * 2 : false),
  });
}

export interface StartLiveSessionBody {
  engagementId: string;
  taskId: string;
  portalLoginLabel: string;
  approvedKeys?: string[];
  typeOnPortal?: string[];
  mode?: 'live' | 'mock';
}

export function useStartLiveSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: StartLiveSessionBody) =>
      readJson<{ session: LiveSessionView }>(
        await fetch('/api/live-browser/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(['live-browser-session', data.session.id], { session: data.session, me: data.session.startedBy ?? '' });
      void queryClient.invalidateQueries({ queryKey: ['live-browser-sessions'] });
    },
  });
}

export function useStopLiveSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => readJson<{ ok: true }>(await fetch(`/api/live-browser/sessions/${id}/stop`, { method: 'POST' })),
    onSuccess: (_d, id) => {
      void queryClient.invalidateQueries({ queryKey: ['live-browser-session', id] });
      void queryClient.invalidateQueries({ queryKey: ['live-browser-sessions'] });
    },
  });
}

/** A fresh two-minute viewer token; asked for each time the stream (re)connects. */
export async function fetchViewerAccess(id: string, role: 'watch' | 'act'): Promise<ViewerAccess> {
  return readJson<ViewerAccess>(await fetch(`/api/live-browser/sessions/${id}/token?role=${role}`, { cache: 'no-store' }));
}

/** The card panel opened: keep a browser warm. Never starts a session or opens a portal. */
export async function warmLiveBrowser(): Promise<void> {
  await fetch('/api/live-browser/warm', { method: 'POST' }).catch(() => undefined);
}
