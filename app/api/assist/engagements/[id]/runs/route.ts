import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listAssistRuns } from '@/db/repositories/assist-runs';
import { assistSetUp } from '@/lib/assist-runs/runs';
import { handleAssistIngest } from '@/lib/assist-runs/ingest-route';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * VCFO Assist, the extension's side (C-324, C-363, C-377, S-773, S-809).
 *
 * GET  /api/assist/engagements/[id]/runs — the engagement's runs, newest first, so the
 *      extension can pick up a run staff requested with "Start filing" (state `requested`).
 * POST /api/assist/engagements/[id]/runs — progress or result of one run (body: see
 *      `ingestSchema` in src/lib/assist-runs/runs.ts; header Idempotency-Key optional).
 * Staff session only; 503 while VCFO_ASSIST_ENABLED is not on.
 */
export async function GET(_request: Request, context: RouteContext) {
  if (!assistSetUp()) return NextResponse.json({ ok: false, error: 'assist_not_set_up' }, { status: 503 });
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const runs = await listAssistRuns(guard.ctx, { engagementId: id });
  if (!runs) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  return NextResponse.json({ ok: true, runs }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return handleAssistIngest(request, id);
}
