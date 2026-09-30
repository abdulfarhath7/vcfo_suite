'use client';

import { useEffect, useState } from 'react';
import { useAskOptional } from './ask-context';

/** D2 / D5: push at ≥1440 px, overlay at 1024–1439 px, bottom sheet below. */
export type AskLayoutMode = 'push' | 'overlay' | 'sheet';

export const ASK_PANEL_WIDTH = 400;

function modeFor(width: number): AskLayoutMode {
  if (width >= 1440) return 'push';
  if (width >= 1024) return 'overlay';
  return 'sheet';
}

export function useAskLayoutMode(): AskLayoutMode {
  const [mode, setMode] = useState<AskLayoutMode>('overlay');
  useEffect(() => {
    const update = () => setMode(modeFor(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return mode;
}

/** Right padding the shell adds while the panel pushes content (≥1440 px). */
export function useAskPushPadding(): number {
  const ask = useAskOptional();
  const mode = useAskLayoutMode();
  return ask?.open && mode === 'push' ? ASK_PANEL_WIDTH : 0;
}
