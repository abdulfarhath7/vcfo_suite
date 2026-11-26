'use client';

import { useEffect, useRef } from 'react';
import type { LiveViewState } from '@/lib/live-browser/contract';
import { chime, notify } from './attention';

/** Sound and desktop notice once each time the agent stops for the person (watch view, in the app). */
export function useYourTurnSignal(state: LiveViewState | null, agentName: string): void {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const key = state?.status === 'your_turn' ? `${state.gate}|${state.page}` : null;
    if (key && key !== last.current) {
      chime();
      notify(`Your turn: ${agentName}`, state?.line ?? 'The agent needs you on the portal tab.');
    }
    last.current = key;
  }, [state?.status, state?.gate, state?.page, state?.line, agentName]);
}
