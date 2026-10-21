import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listWorkItems, upsertWorkItem } from '@/db/repositories/client-home';

/**
 * POST /api/client/home/work-items — staff (admin / manager / lead) create or
 * update a work item the client sees under Home › "What SBC is doing":
 * { engagementId, id?, title, stepId?, assigneeId?, progressPct?, readyOn?, status? }.
 * Clients and out-of-scope engagements get 404.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const engagementId = s(body.engagementId);
  const title = s(body.title);
  if (!engagementId || !title) return NextResponse.json({ error: 'engagementId and title are required' }, { status: 400 });
  const readyOn = s(body.readyOn);
  if (readyOn && !/^\d{4}-\d{2}-\d{2}$/.test(readyOn)) return NextResponse.json({ error: 'invalid_ready_on' }, { status: 400 });
  const status = body.status === 'done' || body.status === 'hidden' ? body.status : 'active';
  const item = await upsertWorkItem(guard.ctx, {
    engagementId,
    id: s(body.id),
    title: title.slice(0, 160),
    stepId: s(body.stepId) ?? null,
    assigneeId: s(body.assigneeId) ?? null,
    progressPct: typeof body.progressPct === 'number' ? body.progressPct : undefined,
    readyOn: readyOn ?? null,
    status,
  });
  if (!item) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ item });
}

/** GET /api/client/home/work-items?engagementId= — the staff editor's list (scoped read). */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const engagementId = new URL(request.url).searchParams.get('engagementId') ?? '';
  if (!engagementId) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await listWorkItems(guard.ctx, engagementId) });
}
