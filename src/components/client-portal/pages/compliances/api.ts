'use client';

/**
 * Data for the compliances pages — TanStack Query over the NEW
 * /api/client/compliances routes (repository: client-compliances.ts).
 */
import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { todayIso, type PortalFiling } from '@/lib/client-portal/compliances';
import type { ViewerDoc } from '../documents/DocViewer';

export const COMP_KEY = ['client-compliances'] as const;

export function useCompFilings(fy: number, enabled = true) {
  return useQuery({
    queryKey: [...COMP_KEY, fy],
    enabled,
    queryFn: async (): Promise<{ rows: PortalFiling[]; today: string }> => {
      const res = await fetch(`/api/client/compliances?fy=${fy}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { rows?: PortalFiling[]; today?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not load the register');
      return { rows: data.rows ?? [], today: data.today ?? todayIso() };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export interface ProofMeta {
  id: string;
  fileName: string;
  mime: string | null;
  sizeBytes: number | null;
  kind: string;
  isPrimary: boolean;
  uploadedAt: string;
  uploadedBy: string | null;
}

export function useProofs(filingId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...COMP_KEY, 'proofs', filingId],
    enabled: Boolean(filingId) && enabled,
    queryFn: async (): Promise<ProofMeta[]> => {
      const res = await fetch(`/api/client/compliances/${filingId}/proofs`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as { proofs?: ProofMeta[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not load the proof');
      return data.proofs ?? [];
    },
    staleTime: 60_000,
  });
}

export function proofHref(filingId: string, proofId: string): string {
  return `/api/client/compliances/${filingId}/proofs/${encodeURIComponent(proofId)}`;
}

export async function fetchProofs(filingId: string): Promise<ProofMeta[]> {
  const res = await fetch(`/api/client/compliances/${filingId}/proofs`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load the proof');
  return ((await res.json()) as { proofs: ProofMeta[] }).proofs ?? [];
}

/** Proof files → the shared DocViewer's contract (lazy signed URLs). */
export function viewerDocs(f: PortalFiling, proofs: ProofMeta[]): ViewerDoc[] {
  return proofs.map((p) => ({
    id: `${f.id}:${p.id}`,
    name: p.fileName,
    contentType: p.mime,
    sizeBytes: p.sizeBytes,
    meta: `${f.name} · ${f.period}${f.filedOn ? ` · filed ${new Date(`${f.filedOn}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}`,
    chip: { text: 'Filed', tone: 'ok' as const },
    uploadedAt: p.uploadedAt,
    uploadedBy: p.uploadedBy ?? undefined,
    url: async () => {
      const res = await fetch(`${proofHref(f.id, p.id)}?json=1`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not open the proof');
      return ((await res.json()) as { url: string }).url;
    },
  }));
}

/** "Remind me" with Undo. */
export function useReminder() {
  const qc = useQueryClient();
  const set = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/client/compliances/${id}/reminder`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ channels: ['email'] }),
      });
      const data = (await res.json().catch(() => ({}))) as { remindOn?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Could not set the reminder');
      return data.remindOn ?? null;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: COMP_KEY }),
  });
  const clear = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/client/compliances/${id}/reminder`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove the reminder');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: COMP_KEY }),
  });
  return { set, clear };
}

/** Trigger a file download from a same-origin route. */
export function useDownload() {
  return useCallback((href: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.rel = 'noopener';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, []);
}
