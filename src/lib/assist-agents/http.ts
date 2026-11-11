import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireAnyRole, type GuardResult } from '@/auth/guards';
import { AssistAgentAccessError, type RequestSeen } from '@/db/repositories/assist-agent-runs';
import { clientIp } from '@/lib/growth/demo-request';
import { AssistResolveRefused } from './resolve';

/**
 * The VCFO Assist agent routes' shared edges. Staff only: super admin (through `admin`), admin,
 * manager and project lead; clients and developers get 403 from the guard. The routes are
 * same-origin (the extension fetches from inside a signed-in Suite tab,
 * docs/specs/assist-profile/06-no-cors.md), so none of them sets a CORS header or answers OPTIONS.
 */

export const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' } as const;

export function assistStaffGuard(): Promise<GuardResult> {
  return requireAnyRole('admin', 'manager', 'intern');
}

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export function guardFailure(guard: Extract<GuardResult, { ok: false }>): NextResponse {
  return json({ ok: false, error: guard.error }, guard.status);
}

/** Maps the errors the repositories and the resolver throw on purpose; anything else is a 500. */
export function assistErrorResponse(error: unknown, label: string): NextResponse {
  if (error instanceof AssistAgentAccessError) return json({ ok: false, error: error.message }, error.status);
  if (error instanceof AssistResolveRefused) return json({ ok: false, error: error.message }, 422);
  if (error instanceof ZodError) return json({ ok: false, error: error.issues[0]?.message ?? 'invalid_body' }, 400);
  console.error(`[assist-agents] ${label} failed`, error);
  return json({ ok: false, error: 'server_error' }, 500);
}

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A run or patch id from the URL; anything else reads as not found before it reaches Postgres. */
export function isRowId(value: string): boolean {
  return UUID_SHAPE.test(value);
}

/**
 * What Suite saw of a run API call, for the run's evidence log (SAFETY.md G14). The IP is the
 * address App Runner's front proxy reported: the proxy appends it to X-Forwarded-For, so it is the
 * right-most entry, the first hop Suite itself trusts (`clientIp`); entries to its left were written
 * by the caller and can be spoofed, so the whole chain is kept beside it, marked as such.
 */
export function requestSeen(request: Request): RequestSeen {
  return {
    ip: clientIp(request.headers),
    forwardedFor: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  };
}
