import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole, requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { AssistForbiddenError, listAssistRuns, requestAssistRun } from '@/db/repositories/assist-runs';
import { assistSetUp } from '@/lib/assist-runs/runs';

/**
 * VCFO Assist, the Suite side (C-324, C-363, C-377, S-773, S-809).
 *
 * GET  /api/assist/runs?engagementId=&kind=filing|registration&key= — runs, newest first,
 *      with `setUp` (false while VCFO_ASSIST_ENABLED is off: the parts show "Not set up").
 *      A client reads its own engagement without `engagementId`.
 * POST /api/assist/runs { engagementId, kind, key, form? } — "Start filing": a requested run
 *      the extension picks up. Staff only.
 */
const kind = z.enum(['filing', 'registration']);
const query = z.object({
  engagementId: z.string().trim().min(1).max(80).optional(),
  kind: kind.optional(),
  key: z.string().trim().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const p = new URL(request.url).searchParams;
  const parsed = query.safeParse({ engagementId: p.get('engagementId') ?? undefined, kind: p.get('kind') ?? undefined, key: p.get('key') ?? undefined });
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  const setUp = assistSetUp();
  if (!setUp) return NextResponse.json({ ok: true, setUp, runs: [] });
  const runs = await listAssistRuns(guard.ctx, { engagementId: parsed.data.engagementId, subjectKind: parsed.data.kind, subjectKey: parsed.data.key });
  if (!runs) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, setUp, runs }, { headers: { 'Cache-Control': 'private, no-store' } });
}

const body = z.object({
  engagementId: z.string().trim().min(1).max(80),
  kind,
  key: z.string().trim().min(1).max(120),
  form: z.string().trim().max(80).optional(),
});

export async function POST(request: Request) {
  if (!assistSetUp()) return NextResponse.json({ ok: false, error: 'assist_not_set_up' }, { status: 503 });
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: parsed.status });
  try {
    const run = await requestAssistRun(guard.ctx, { engagementId: parsed.data.engagementId, subjectKind: parsed.data.kind, subjectKey: parsed.data.key, form: parsed.data.form });
    if (!run) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, run });
  } catch (e) {
    if (e instanceof AssistForbiddenError) return NextResponse.json({ ok: false, error: e.message }, { status: 403 });
    console.error('[assist] start failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
