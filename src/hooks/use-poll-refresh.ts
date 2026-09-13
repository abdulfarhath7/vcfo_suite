'use client';

import { useEffect, useRef } from 'react';

/**
 * Visibility-aware poll: ask the API again on an interval. Pauses while the
 * tab is hidden and fires once immediately when it becomes visible again.
 * Two people editing the same record can be up to `intervalMs` apart; the
 * upgrade path is SSE or a websocket on our own server.
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
