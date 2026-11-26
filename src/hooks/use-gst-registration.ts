'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch } from '@/lib/projects/engagements-db';
import type { GstMissing } from '@/lib/registrations/gst-profile';
import type { GstReadinessView } from '@/lib/registrations/gst-readiness';

export const GST_REGISTRATION_QUERY_KEY = 'gst-registration';

const path = (engagementId: string) => `/api/engagements/${encodeURIComponent(engagementId)}/gst-registration`;

export interface GstRegistrationRead {
  engagementId: string;
  projectKey: string;
  view: GstReadinessView;
  missing: GstMissing[];
  /** Flat `sourceField` → value the tool holds (the card agent's Ready list). */
  fields?: Record<string, string | number | boolean>;
  notes: Array<{ key: string; note: string }>;
  documents: Array<{ key: string; label: string; fileName: string; source: string }>;
  zoho: { linked: boolean; name?: string };
}

/** The GST REG-01 readiness of one engagement (staff). */
export function useGstRegistration(engagementId: string | null | undefined) {
  return useQuery({
    queryKey: [GST_REGISTRATION_QUERY_KEY, engagementId ?? ''] as const,
    queryFn: () => apiFetch<{ ok: true } & GstRegistrationRead>(path(engagementId as string), { fallbackError: 'Could not load the GST application.' }),
    enabled: Boolean(engagementId),
    staleTime: 15_000,
  });
}

/** The page's sourcing buttons when Ask VCFO is not mounted: SharePoint fetch or a client request list. */
export function useGstSourcing(engagementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: 'fetch_sharepoint' | 'ask_client') =>
      apiFetch<{ ok: true; message: string; href?: string; runId?: string }>(path(engagementId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
        fallbackError: 'Could not start that.',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: [GST_REGISTRATION_QUERY_KEY, engagementId] }),
  });
}
