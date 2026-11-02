'use client';

import { useQuery } from '@tanstack/react-query';
import type { HomeTrendHome, HomeTrends } from '@/lib/metrics/home-trends';

/**
 * The past values behind a home card's trend lines (`GET /api/metrics/home-trends`, R-18).
 * Trends never block the home: until they load, and when they fail, the tiles draw no line.
 */
export function useHomeTrends(home: HomeTrendHome, opts: { engagementId?: string; enabled?: boolean } = {}) {
  const params = new URLSearchParams({ home });
  if (opts.engagementId) params.set('engagementId', opts.engagementId);
  const query = useQuery({
    queryKey: ['metrics', 'home-trends', home, opts.engagementId ?? null],
    queryFn: async (): Promise<HomeTrends> => {
      const res = await fetch(`/api/metrics/home-trends?${params.toString()}`);
      const body = (await res.json().catch(() => ({}))) as { trends?: HomeTrends; error?: string };
      if (!res.ok || !body.trends) throw new Error(body.error ?? 'Could not load the trends');
      return body.trends;
    },
    staleTime: 5 * 60_000,
    retry: false,
    enabled: opts.enabled ?? true,
  });
  return query.data;
}

/**
 * A tile's trend line: the stored past values, then the live count as the last point. Nothing
 * when the tile has no history or its value is not a number, so no line is drawn.
 */
export function trendWithLive(trends: HomeTrends | undefined, key: string, live: number | string | null | undefined): number[] | undefined {
  const past = trends?.[key];
  if (!past?.length || typeof live !== 'number' || !Number.isFinite(live)) return undefined;
  return [...past, live];
}

/** The label a tile shows when it has no past values yet (owner item B2). */
export const NO_HISTORY = 'No history yet';

/**
 * A home tile's line: the past values plus the live count (`trendWithLive`). When the trends
 * have loaded but the tile has no past values, `trendEmpty` asks the tile for a flat line and
 * "No history yet". `add` sums a second series into the first point by point (the client
 * Overdue tile after the COI adds the overdue filings); a shorter series trims the longer one,
 * so no point is invented. While the trends load, nothing is drawn.
 */
export function tileTrend(
  trends: HomeTrends | undefined,
  key: string,
  live: number | string | null | undefined,
  add?: string,
): { trend?: number[]; trendEmpty?: string } {
  if (!trends) return {};
  let past = trends[key];
  if (past && add) {
    const extra = trends[add] ?? [];
    const n = Math.min(past.length, extra.length);
    past = Array.from({ length: n }, (_, i) => past![past!.length - n + i]! + extra[extra.length - n + i]!);
  }
  const trend = trendWithLive(past ? { [key]: past } : {}, key, live);
  return trend ? { trend } : { trendEmpty: NO_HISTORY };
}
