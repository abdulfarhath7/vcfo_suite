'use client';

import { useCallback, useEffect, useState } from 'react';
import { readDensity, takeLastVisit, writeDensity, type Density } from '@/lib/ui/table-prefs';

/**
 * E-07: Comfortable (44px) or Compact (32px) rows, kept per `scope` (a user id or a table name)
 * in localStorage. The first render is always Comfortable so the server and client agree; the
 * stored choice applies right after mount. Pass `enabled = false` to skip storage entirely.
 */
export function useDensity(scope: string, enabled = true): [Density, (d: Density) => void] {
  const [density, setDensityState] = useState<Density>('comfortable');
  useEffect(() => {
    if (enabled) setDensityState(readDensity(scope));
  }, [scope, enabled]);
  const setDensity = useCallback(
    (d: Density) => {
      setDensityState(d);
      if (enabled) writeDensity(scope, d);
    },
    [scope, enabled],
  );
  return [density, setDensity];
}

/**
 * E-08: the time of the person's previous visit to this page (ms), or null before mount and when
 * `pageKey` is not given. Rows that changed after it get the "new since last visit" square.
 * `seed` is the last visit to assume when the browser has none stored (for example the user's
 * last sign-in); without it every row with a time counts as new on the first visit.
 */
export function useLastVisit(pageKey: string | undefined, seed?: number): number | null {
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    if (!pageKey) {
      setSince(null);
      return;
    }
    setSince(takeLastVisit(pageKey, { seed }));
  }, [pageKey, seed]);
  return since;
}
