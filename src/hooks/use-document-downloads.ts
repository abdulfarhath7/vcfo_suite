'use client';

import { useQuery } from '@tanstack/react-query';
import { documentDownloadsPath, type DownloadCatalogDto } from '@/lib/document-downloads/client';

/**
 * Every document of one engagement, sorted for download (GET /api/engagements/:id/document-downloads).
 * Staff only. The download pop-up and the SPICe+ attachments card share this one query.
 */
export function useDocumentCatalog(engagementId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['document-downloads', engagementId ?? ''],
    enabled: Boolean(engagementId) && enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<DownloadCatalogDto> => {
      const res = await fetch(documentDownloadsPath(engagementId as string), { cache: 'no-store' });
      const out = (await res.json().catch(() => ({}))) as DownloadCatalogDto & { error?: string };
      if (!res.ok) throw new Error(out.error || 'The document list could not be loaded.');
      return out;
    },
  });
}
