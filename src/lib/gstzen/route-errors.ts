import 'server-only';

import { NextResponse } from 'next/server';
import { GstAgentError } from '@/db/repositories/gst-agent-scope';
import { GstzenError } from './client';

/** One plain JSON error for the GSTZen routes. Unknown errors answer 500 without detail. */
export function gstzenErrorResponse(err: unknown): NextResponse {
  if (err instanceof GstAgentError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof GstzenError) return NextResponse.json({ error: err.message }, { status: err.kind === 'not_configured' ? 503 : 502 });
  return NextResponse.json({ error: 'The GST agent could not finish this step. Try again.' }, { status: 500 });
}

/** The staff roles every GSTZen staff route admits. */
export const GSTZEN_STAFF_ROLES = ['super_admin', 'admin', 'manager', 'intern'] as const;
