'use client';

import { useCallback } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@/lib/auth';
import { usePollRefresh } from '@/lib/supabase/use-poll-refresh';

/**
 * Invalidate the knowledge bank list when files may have been added or removed.
 *
 * Was a Supabase Realtime subscription on `knowledge_bank_files`; now a
 * visibility-aware poll. The role check is kept because clients have no access
 * to the knowledge bank at all (see src/db/repositories/knowledge-bank.ts) —
 * polling for them would be pure wasted requests that always 403.
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
