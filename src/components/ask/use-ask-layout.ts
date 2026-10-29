'use client';

import { useEffect, useState } from 'react';

/**
 * VCFO Spectrum (F-299): from 640 px Ask VCFO is a floating card at the bottom right,
 * 420 x 620 px, over the page and without a scrim, so it can stay open while the person
 * reads the page beside it. Under 640 px it fills the screen.
 */
export type AskLayoutMode = 'float' | 'sheet';

export const ASK_PANEL_WIDTH = 420;
export const ASK_PANEL_HEIGHT = 620;

function modeFor(width: number): AskLayoutMode {
  return width >= 640 ? 'float' : 'sheet';
}

export function useAskLayoutMode(): AskLayoutMode {
  const [mode, setMode] = useState<AskLayoutMode>('float');
  useEffect(() => {
    const update = () => setMode(modeFor(window.innerWidth));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return mode;
}

/**
 * Right padding the shell adds for the panel. The floating card sits over the page, so
 * this is always 0; the hook stays so the shell column keeps one place to ask.
 */
export function useAskPushPadding(): number {
  return 0;
}
