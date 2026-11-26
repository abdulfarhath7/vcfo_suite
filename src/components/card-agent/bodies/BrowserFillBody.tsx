'use client';

import type { CardAgentBodyProps } from './types';

/**
 * The body of a browser-route card agent once "Fill now" is pressed: it starts the live session
 * and opens live mode. Built by the live browser work stream; this placeholder keeps the panel
 * compiling until then.
 */
export function BrowserFillBody({ task }: CardAgentBodyProps) {
  return <p className="text-[13px] text-ink-muted">{task.name} fills the portal in the live browser. Not set up yet.</p>;
}
