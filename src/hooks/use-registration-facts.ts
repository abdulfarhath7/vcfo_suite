'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegistrationFacts, RegistrationFactsMap } from '@/lib/registrations/registration-facts';

export type { RegistrationFacts, RegistrationFactsMap };

const KEY = 'registration-facts';

/**
 * Registration numbers, dates, certificates and renewal dates (G-05, G-06) from
 * `GET /api/registrations`, by app engagement id, then by step id. Without an
 * `engagementId` a staff member gets every engagement in scope (the Registrations list);
 * a client always gets its own engagement.
 */
export function useRegistrationFacts(opts: { engagementId?: string | null; enabled?: boolean } = {}) {
  const engagementId = opts.engagementId?.trim() || null;
  return useQuery({
    queryKey: [KEY, engagementId ?? 'scope'],
    enabled: opts.enabled ?? true,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<Record<string, RegistrationFactsMap>> => {
      const q = engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : '';
      const res = await fetch(`/api/registrations${q}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { byEngagement: Record<string, RegistrationFactsMap> }).byEngagement ?? {};
    },
  });
}

export interface RegistrationDatesPatch {
  engagementId: string;
  stepId: string;
  issuedOn: string | null;
  expiresOn: string | null;
  renewEveryMonths: number | null;
}

/** Staff save one registration's issue date, expiry and renewal period. */
export function useSetRegistrationDates() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: RegistrationDatesPatch): Promise<RegistrationFactsMap> => {
      const res = await fetch('/api/registrations/dates', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const out = (await res.json().catch(() => ({}))) as { facts?: RegistrationFactsMap; error?: string };
      if (!res.ok || !out.facts) throw new Error(out.error ?? String(res.status));
      return out.facts;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

/** Open one registration's certificate in a new tab through a short-lived signed URL. */
export async function openRegistrationCertificate(stepId: string, engagementId?: string | null): Promise<void> {
  const q = new URLSearchParams({ stepId });
  if (engagementId) q.set('engagementId', engagementId);
  // Open the tab first, inside the click, so a pop-up blocker lets it through; cut its
  // link back to this page before the signed URL loads.
  const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  if (tab) tab.opener = null;
  const res = await fetch(`/api/registrations/certificate?${q.toString()}`, { cache: 'no-store' });
  const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !out.url) {
    tab?.close();
    throw new Error(out.error ?? String(res.status));
  }
  if (tab) tab.location.href = out.url;
  else window.location.assign(out.url);
}
