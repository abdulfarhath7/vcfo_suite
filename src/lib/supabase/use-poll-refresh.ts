'use client';

import { useEffect, useRef } from 'react';

/**
 * Polling replacement for Supabase Realtime postgres_changes subscriptions.
 *
 * The original opened a WebSocket channel per table and relied on RLS to decide
 * what each subscriber was allowed to see. We have no realtime server, and the
 * equivalent scoping now lives in the repository layer, so the honest
 * substitute is a poll: ask the API again on an interval.
 *
 * Two behaviours keep this cheap:
 *   - it pauses while the tab is hidden, and
 *   - it fires once immediately on becoming visible again, so a user returning
 *     to the tab sees fresh data without waiting out the interval.
 *
 * This is genuinely weaker than realtime — two people editing the same record
 * can be up to `intervalMs` out of date with each other. If that becomes a
 * problem the upgrade path is SSE or a websocket on our own server, not
 * Supabase.
 */
export interface UsePollRefreshOptions {
  enabled: boolean;
  intervalMs?: number;
  onRefresh: () => void;
}

export function usePollRefresh({
  enabled,
  intervalMs = 15_000,
  onRefresh,
}: UsePollRefreshOptions): void {
  // Keep the latest callback without restarting the interval on every render.
  const cb = useRef(onRefresh);
  useEffect(() => {
    cb.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      if (timer !== undefined) return;
      timer = setInterval(() => cb.current(), intervalMs);
    };
    const stop = () => {
      if (timer === undefined) return;
      clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        cb.current(); // catch up immediately
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, intervalMs]);
}
