'use client';

import { useQuery } from '@tanstack/react-query';
import { canUseAsk } from '@/lib/ask/access';
import { fetchAskStatus } from './ask-api';

/** Runtime flag + firm name. Never fetched for managers or Project Leads. */
export function useAskStatus(role: string | null | undefined) {
  const allowed = canUseAsk(role);
  const query = useQuery({
    queryKey: ['ask', 'status'],
    queryFn: fetchAskStatus,
    enabled: allowed,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return {
    enabled: allowed && query.data?.enabled === true,
    firmName: query.data?.firmName ?? 'SBC',
  };
}
