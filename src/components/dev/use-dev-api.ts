'use client';

import { useQuery } from '@tanstack/react-query';

/**
 * GET a developer console route. The query key is the URL, so a filter change refetches.
 * A plain fetch, not the provider's `fetchJson`, so a refused call shows its error in the
 * card instead of signing the person out.
 */
export function useDevApi<T>(url: string, opts: { refetchMs?: number } = {}) {
  return useQuery<T>({
    queryKey: ['dev', url],
    queryFn: async () => {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      return (await res.json()) as T;
    },
    staleTime: 15_000,
    refetchInterval: opts.refetchMs,
  });
}
