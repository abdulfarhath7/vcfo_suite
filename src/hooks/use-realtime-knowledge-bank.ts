'use client';

import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@/lib/auth';
import { usePollRefresh } from '@/hooks/use-poll-refresh';

/**
 * Invalidate the knowledge bank list on a visibility-aware poll. Clients have
 * no knowledge-bank access (see src/db/repositories/knowledge-bank.ts), so the
 * poll only runs for staff roles.
 */
export interface UseRealtimeKnowledgeBankOptions {
  user: AuthUser | null;
  queryClient: QueryClient;
  enabled?: boolean;
}

export function useRealtimeKnowledgeBank({
  user,
  queryClient,
  enabled = true,
}: UseRealtimeKnowledgeBankOptions): void {
  const handleChange = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['knowledge-bank'] });
  }, [queryClient]);

  const roleOk =
    user?.role === 'admin' || user?.role === 'manager' || user?.role === 'intern';

  usePollRefresh({
    enabled: Boolean(enabled && user && roleOk),
    onRefresh: handleChange,
  });
}
