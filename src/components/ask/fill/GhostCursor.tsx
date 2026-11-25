'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { m } from 'framer-motion';
import { useFillState } from './fill-store';

/**
 * The small "Ask" cursor that glides to each field while Manual fill types it. Spring motion,
 * brand colour, no pointer events; it never shows under reduced motion (the player keeps it
 * hidden then). A short pop on `pulse` marks a picker or date being set.
 */
export function GhostCursor() {
  const fill = useFillState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !fill || !fill.cursor.visible) return null;
  const { x, y, pulse } = fill.cursor;
  return createPortal(
    <m.div
      aria-hidden
      data-testid="ask-ghost-cursor"
      className="pointer-events-none fixed left-0 top-0 z-[90]"
      initial={{ x, y, opacity: 0, scale: 0.8 }}
      animate={{ x, y, opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28, mass: 0.7 }}
    >
      <m.div
        key={pulse}
        className="flex items-start gap-0.5"
        initial={pulse > 0 ? { scale: 0.82 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 18 }}
      >
        <svg width="14" height="16" viewBox="0 0 14 16" className="drop-shadow-sm" aria-hidden>
          <path d="M1 1 L1 13 L4.5 9.8 L7 15 L9.2 14 L6.8 8.9 L12 8.6 Z" className="fill-brand stroke-surface-raised" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        <span className="mt-3 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-semibold leading-none text-on-brand shadow-shine">
          Ask
        </span>
      </m.div>
    </m.div>,
    document.body,
  );
}
