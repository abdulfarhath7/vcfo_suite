/**
 * Minimal compatibility stub for board resolution progress.
 *
 * The real implementation is pending, but client imports need a valid export.
 */
import { useMemo } from 'react';

export function useBoardResolutionProgress(_engagementId?: string | null) {
  return useMemo(() => ({ snapshot: null }), []);
}
