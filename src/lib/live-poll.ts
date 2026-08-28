'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

/** Live inbox / announcements popup cadence. Full lists fetch only when the head changes. */
export const LIVE_POLL_MS = 4_000;

export function fingerprintHead(parts: Array<string | number | null | undefined>): string {
  return parts.map((part) => (part == null ? '' : String(part))).join('|');
}

/** First successful head seeds history. Later mismatches mean the full query is stale. */
export function shouldInvalidateOnHeadChange(
  previous: string | undefined,
  next: string,
): boolean {
  if (previous === undefined) return false;
  return previous !== next;
}

export function useInvalidateOnHeadChange(options: {
  enabled: boolean;
  headQueryKey: readonly unknown[];
  queryFn: () => Promise<{ fingerprint: string }>;
  invalidateQueryKey: readonly unknown[];
  exact?: boolean;
}): void {
  const { enabled, headQueryKey, queryFn, invalidateQueryKey, exact } = options;
  const queryClient = useQueryClient();
  const previous = useRef<string | undefined>(undefined);
  const invalidateKeyRef = useRef(invalidateQueryKey);
  invalidateKeyRef.current = invalidateQueryKey;
  const headKeyHash = headQueryKey.map(String).join('\0');

  useEffect(() => {
    previous.current = undefined;
  }, [headKeyHash]);

  const head = useQuery({
    queryKey: headQueryKey,
    queryFn,
    enabled,
    staleTime: LIVE_POLL_MS,
    refetchInterval: enabled ? LIVE_POLL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    notifyOnChangeProps: ['data'],
  });

  const fingerprint = head.data?.fingerprint;

  useEffect(() => {
    if (!enabled || fingerprint == null) return;
    const prev = previous.current;
    previous.current = fingerprint;
    if (!shouldInvalidateOnHeadChange(prev, fingerprint)) return;
    void queryClient.invalidateQueries({
      queryKey: invalidateKeyRef.current,
      exact: exact ?? false,
    });
  }, [enabled, fingerprint, queryClient, exact]);
}
