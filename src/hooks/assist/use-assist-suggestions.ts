'use client';

import { useQuery } from '@tanstack/react-query';
import type { AssistShell } from '@/data/assist/schema';
import { fetchSuggestions } from './assist-api';

export function useAssistSuggestions(shell: AssistShell | null, engagementId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['assist', 'suggestions', shell, engagementId],
    queryFn: () => fetchSuggestions(shell!, engagementId),
    enabled: enabled && Boolean(shell) && (shell !== 'client' || Boolean(engagementId)),
    staleTime: 60_000,
  });
}
