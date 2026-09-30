'use client';

import { useQuery } from '@tanstack/react-query';
import { canUseAssist } from '@/lib/assist/access';
import { fetchAssistStatus } from './assist-api';

/** Runtime flag + firm name. Never fetched for managers or Project Leads. */
export function useAssistStatus(role: string | null | undefined) {
  const allowed = canUseAssist(role);
  const query = useQuery({
    queryKey: ['assist', 'status'],
    queryFn: fetchAssistStatus,
    enabled: allowed,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return {
    enabled: allowed && query.data?.enabled === true,
    firmName: query.data?.firmName ?? 'SBC',
  };
}
