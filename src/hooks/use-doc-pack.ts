'use client';

import { useQuery } from '@tanstack/react-query';

import { docPackApiPath } from '@/lib/doc-pack/paths';
import type { DocPackSummary } from '@/lib/doc-pack/types';
import { apiFetch } from '@/lib/engagements-db';

export const DOC_PACK_QUERY_KEY = 'doc-pack';

export function docPackQueryKey(engagementId: string): readonly [string, string] {
  return [DOC_PACK_QUERY_KEY, engagementId] as const;
}

export async function fetchDocPack(engagementId: string): Promise<DocPackSummary> {
  const body = await apiFetch<{ ok: true; pack: DocPackSummary }>(docPackApiPath(engagementId), {
    fallbackError: 'Could not load the document pack.',
  });
  return body.pack;
}

/**
 * Readiness of the pre-incorporation document pack. Invalidated by the
 * checklist save path (`use-app-provider-value`) so the rail card and the
 * pack page follow autosave without a reload.
 */
export function useDocPack(engagementId: string | null | undefined) {
  return useQuery({
    queryKey: docPackQueryKey(engagementId ?? ''),
    queryFn: () => fetchDocPack(engagementId as string),
    enabled: Boolean(engagementId),
    staleTime: 15_000,
  });
}
