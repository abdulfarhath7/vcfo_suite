'use client';

import { useQuery } from '@tanstack/react-query';
import type { Announcement, AnnouncementSource } from '@/lib/announcements';

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'request_failed');
  }
  return data;
}

export function useAnnouncements(limit?: number) {
  return useQuery({
    queryKey: ['announcements', limit ?? 'all'],
    queryFn: async () => {
      const q = limit ? `?limit=${limit}` : '';
      return readJson<{ announcements: Announcement[]; canWrite: boolean }>(
        await fetch(`/api/announcements${q}`),
      );
    },
    staleTime: 2_000,
    refetchInterval: 4_000,
    refetchOnWindowFocus: true,
  });
}

export function useAnnouncementSources(enabled: boolean) {
  return useQuery({
    queryKey: ['announcement-sources'],
    enabled,
    queryFn: async () => {
      return readJson<{ sources: AnnouncementSource[] }>(await fetch('/api/announcements/sources'));
    },
  });
}
