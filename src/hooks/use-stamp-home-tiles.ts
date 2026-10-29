'use client';

import { useEffect, useRef } from 'react';
import type { StampHome } from '@/lib/metrics/home-tile-stamps';

/**
 * Sends the numbers a staff home's tiles show today (`POST /api/metrics/home-tiles`), so the
 * next days can draw a trend line for tiles whose past keeps no history (F-071, F-072).
 *
 * Pass `null` while the tiles are still loading, or when they show a narrowed view (a scope
 * switch other than All): only the whole home is stored. A value set is sent once per change,
 * a second after it settles; a failure is silent because trends never block the home.
 */
export function useStampHomeTiles(home: StampHome, values: Record<string, number> | null, enabled = true): void {
  const sent = useRef<string | null>(null);
  const body = values && enabled ? JSON.stringify({ home, values }) : null;
  useEffect(() => {
    if (!body || body === sent.current) return;
    const timer = window.setTimeout(() => {
      sent.current = body;
      void fetch('/api/metrics/home-tiles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [body]);
}
