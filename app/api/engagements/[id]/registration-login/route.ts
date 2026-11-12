import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAnyRole } from '@/auth/guards';
import { CredentialsError, getRegistrationLogin, saveRegistrationLogin } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';

type RouteContext = { params: Promise<{ id: string }> };

const STEP = z.string().regex(/^reg-\d{1,3}$/);

const body = z.object({
  step: STEP,
  username: z.string().max(500),
  password: z.string().max(500),
});

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0, must-revalidate' };

function errorResponse(e: unknown) {
  if (e instanceof CredentialsError) {
    return NextResponse.json({ ok: false, error: e.code }, { status: e.status, headers: NO_STORE });
  }
  console.error('[registration-login] route failed', e instanceof Error ? e.message : e);
  return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500, headers: NO_STORE });
}

/**
 * GET /api/engagements/[id]/registration-login?step=reg-1 — the portal username and password of
 * one registration, from the encrypted credentials workbook. Staff only; never cached.
 */
export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const step = STEP.safeParse(new URL(request.url).searchParams.get('step'));
  if (!step.success) return NextResponse.json({ ok: false, error: 'invalid_registration' }, { status: 400 });
  try {
    const login = await getRegistrationLogin(auth.ctx, { engagementId: id, stepId: step.data });
    return NextResponse.json({ ok: true, login }, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}

/** PUT — save the username and password (encrypted, audited as credential edits). Staff only. */
export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const { id } = await context.params;
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const login = await saveRegistrationLogin(auth.ctx, {
      engagementId: id,
      stepId: parsed.data.step,
      username: parsed.data.username,
      password: parsed.data.password,
    });
    return NextResponse.json({ ok: true, login }, { headers: NO_STORE });
  } catch (e) {
    return errorResponse(e);
  }
}
