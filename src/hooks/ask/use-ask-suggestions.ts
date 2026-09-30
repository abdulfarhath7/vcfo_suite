'use client';

import { useQuery } from '@tanstack/react-query';
import type { AskShell } from '@/data/ask/schema';
import { fetchSuggestions } from './ask-api';

export function useAskSuggestions(shell: AskShell | null, engagementId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['ask', 'suggestions', shell, engagementId],
    queryFn: () => fetchSuggestions(shell!, engagementId),
    enabled: enabled && Boolean(shell) && (shell !== 'client' || Boolean(engagementId)),
    staleTime: 60_000,
  });
}
