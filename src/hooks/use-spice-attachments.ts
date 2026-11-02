'use client';

import { useQuery } from '@tanstack/react-query';
import type { SpiceAttachmentList } from '@/lib/spice-attachments/derive';
import { apiFetch } from '@/lib/projects/engagements-db';

/** The SPICe+ attachments of one engagement (GET /api/engagements/:id/spice-attachments). Staff only. */
export function useSpiceAttachments(engagementId: string | null | undefined) {
  return useQuery({
    queryKey: ['spice-attachments', engagementId ?? ''],
    queryFn: async () =>
      (
        await apiFetch<{ ok: true; list: SpiceAttachmentList }>(
          `/api/engagements/${encodeURIComponent(engagementId as string)}/spice-attachments`,
          { fallbackError: 'Could not load the SPICe+ attachments.' },
        )
      ).list,
    enabled: Boolean(engagementId),
    staleTime: 15_000,
  });
}
