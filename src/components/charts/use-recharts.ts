'use client';

import { useEffect, useState } from 'react';

export type RechartsModule = typeof import('recharts');

let cached: RechartsModule | null = null;

/**
 * Lazy recharts loader — keeps ~100kB of charting out of the first paint of
 * every dashboard. Same pattern `AnalyticsCharts.tsx` established; hoisted here
 * so every chart in the app loads the library exactly once.
 */
export function useRecharts(): RechartsModule | null {
  const [recharts, setRecharts] = useState<RechartsModule | null>(cached);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    void import('recharts').then((mod) => {
      cached = mod;
      if (alive) setRecharts(mod);
    });
    return () => {
      alive = false;
    };
  }, []);

  return recharts;
}
