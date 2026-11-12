'use client';

import { useApp } from '@/context/AppContext';
import { sequentialLockMessage } from '@/lib/checklist/checklist-step-gate';

/**
 * The sequential lock message for one checklist step ("This opens after … is complete."), or
 * null when the step is open. Staff step controls that move a step forward (request approval,
 * accept, submit) read it to stay disabled on a locked step. The gate's own `message` is blanked
 * for a lead, who may still open and fill a locked step, so this reads the lock directly.
 * The server refuses the same moves (`staffStatusLockMessage`); this is only the UI mirror.
 */
export function useStepLockMessage(scopeId: string | undefined, itemId: string): string | null {
  const { getState } = useApp();
  if (!scopeId) return null;
  return sequentialLockMessage(itemId, getState(scopeId));
}
