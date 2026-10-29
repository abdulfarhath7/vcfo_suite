import 'server-only';

import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { AssistForbiddenError, ingestAssistRun } from '@/db/repositories/assist-runs';
import { assistSetUp, ingestSchema } from '@/lib/assist-runs/runs';

/** Largest ingest body: a run's steps with their screenshots. */
const MAX_INGEST_BYTES = 12 * 1024 * 1024;

/**
 * The VCFO Assist extension's post, shared by `/api/assist/engagements/[id]/runs` and the
 * extension's existing result path `/api/assist/engagements/[id]/result`. Staff session only
 * (the extension runs the request inside a signed-in Suite tab); 503 while
 * `VCFO_ASSIST_ENABLED` is not on.
 */
export async function handleAssistIngest(request: Request, engagementParam: string): Promise<NextResponse> {
  if (!assistSetUp()) return NextResponse.json({ ok: false, error: 'assist_not_set_up' }, { status: 503 });
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const length = Number(request.headers.get('content-length') ?? NaN);
  if (Number.isFinite(length) && length > MAX_INGEST_BYTES) return NextResponse.json({ ok: false, error: 'body_too_large' }, { status: 413 });
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = ingestSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? 'invalid_body' }, { status: 400 });
  }
  try {
    const out = await ingestAssistRun(guard.ctx, engagementParam, parsed.data, request.headers.get('idempotency-key'));
    if (!out) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, run: out.run }, { status: out.created ? 201 : 200 });
  } catch (e) {
    if (e instanceof AssistForbiddenError) return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    console.error('[assist] ingest failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
