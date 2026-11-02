'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * The filter state of a compliance list (`?state=`, `?view=`, `?by=`, `?company=`).
 *
 * On its own page the state lives in the URL so a refresh keeps it. Embedded as a tab of
 * the staff client record (G-19) the same list keeps its state in memory, so a filter
 * click never navigates away from the record.
 */
export function useViewParams(path: string, embedded: boolean) {
  const router = useRouter();
  const params = useSearchParams();
  const [local, setLocal] = useState<Record<string, string>>({});

  const get = useCallback((key: string): string | null => (embedded ? (local[key] ?? null) : params.get(key)), [embedded, local, params]);

  const set = useCallback(
    (next: Record<string, string | null>) => {
      if (embedded) {
        setLocal((cur) => {
          const out = { ...cur };
          for (const [key, value] of Object.entries(next)) {
            if (value === null || value === '') delete out[key];
            else out[key] = value;
          }
          return out;
        });
        return;
      }
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === '') search.delete(key);
        else search.set(key, value);
      }
      const q = search.toString();
      router.replace(`${path}${q ? `?${q}` : ''}`, { scroll: false });
    },
    [embedded, params, path, router],
  );

  return useMemo(() => ({ get, set }), [get, set]);
}
