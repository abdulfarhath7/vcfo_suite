'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StatutoryCalendarImportResponse, StatutoryCalendarResponse } from '@/lib/statutory-calendar/types';

const KEY = 'statutory-calendar';

/** One financial year's statutory calendar; `fy` null asks for the year that contains today. */
export function useStatutoryCalendar(fy: string | null) {
  return useQuery({
    queryKey: [KEY, fy ?? 'current'],
    staleTime: 300_000,
    queryFn: async () => {
      const res = await fetch(`/api/statutory-calendar${fy ? `?fy=${encodeURIComponent(fy)}` : ''}`);
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'load_failed');
      return (await res.json()) as StatutoryCalendarResponse;
    },
  });
}

export class StatutoryImportError extends Error {
  constructor(
    message: string,
    readonly result: StatutoryCalendarImportResponse | null,
  ) {
    super(message);
  }
}

/** Checks (publish false) or publishes (publish true) an import file. Publishing refreshes every year. */
export function useStatutoryCalendarImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { file: File; fy: string; publish: boolean }) => {
      const form = new FormData();
      form.set('file', input.file);
      form.set('fy', input.fy);
      if (input.publish) form.set('publish', '1');
      const res = await fetch('/api/statutory-calendar/import', { method: 'POST', body: form });
      const body = (await res.json().catch(() => null)) as (StatutoryCalendarImportResponse & { error?: string }) | null;
      if (res.status === 422 && body) return body;
      if (!res.ok || !body) throw new StatutoryImportError(body?.error ?? 'The file could not be checked. Try again.', null);
      return body;
    },
    onSuccess: (result) => {
      if (result.published) void queryClient.invalidateQueries({ queryKey: [KEY] });
    },
  });
}
