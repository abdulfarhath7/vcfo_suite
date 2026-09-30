'use client';

import { useEffect, useState } from 'react';
import { useAssistOptional } from './assist-context';

/** D2 / D5: push at ≥1440 px, overlay at 1024–1439 px, bottom sheet below. */
export type AssistLayoutMode = 'push' | 'overlay' | 'sheet';

export const ASSIST_PANEL_WIDTH = 400;

function modeFor(width: number): AssistLayoutMode {
  if (width >= 1440) return 'push';
  if (width >= 1024) return 'overlay';
  return 'sheet';
}

export function useAssistLayoutMode(): AssistLayoutMode {
  const [mode, setMode] = useState<AssistLayoutMode>('overlay');
  useEffect(() => {
    const update = () => setMode(modeFor(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return mode;
}

/** Right padding the shell adds while the panel pushes content (≥1440 px). */
export function useAssistPushPadding(): number {
  const assist = useAssistOptional();
  const mode = useAssistLayoutMode();
  return assist?.open && mode === 'push' ? ASSIST_PANEL_WIDTH : 0;
}
