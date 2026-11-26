import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { LiveBrowserAccessError } from '@/db/repositories/live-browser-sessions';
import { AgentSettingsForbiddenError } from '@/db/repositories/agent-settings';
import { json } from '@/lib/assist-agents/http';

/** Maps the errors the live browser code throws on purpose; anything else is a 500. */
export function liveBrowserError(error: unknown, label: string): NextResponse {
  if (error instanceof LiveBrowserAccessError) return json({ ok: false, error: error.message }, error.status);
  if (error instanceof AgentSettingsForbiddenError) return json({ ok: false, error: 'forbidden' }, 403);
  if (error instanceof ZodError) return json({ ok: false, error: error.issues[0]?.message ?? 'invalid_body' }, 400);
  console.error(`[live-browser] ${label} failed`, error);
  return json({ ok: false, error: 'server_error' }, 500);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSessionId(value: string): boolean {
  return UUID.test(value);
}
