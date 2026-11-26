'use client';

import type { CardAgentBodyProps } from './types';

/**
 * The body of an API-route card agent (GST returns through GSTZen). Built by the GSTZen work
 * stream; this placeholder keeps the panel compiling until then.
 */
export function ApiFileBody({ task }: CardAgentBodyProps) {
  return <p className="text-[13px] text-ink-muted">{task.name} files through the GSP API. Not set up yet.</p>;
}
