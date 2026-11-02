import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { createPlannerBlocks, listPlannerBlocks } from '@/db/repositories/planner-blocks';
import { plannerError } from '@/lib/planner-blocks-response';

/**
 * GET /api/planner/blocks?from=YYYY-MM-DD&to=YYYY-MM-DD&owner=<profile id>[,<id>…]
 * Calendar blocks the caller may see (repository scope; owner defaults to self).
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(request.url);
  const owners = (url.searchParams.get('owner') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const blocks = await listPlannerBlocks(guard.ctx, {
      ownerIds: owners,
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
    });
    return NextResponse.json({ blocks });
  } catch (err) {
    return plannerError(err);
  }
}

/** POST /api/planner/blocks — `{ blocks: [...] }` or one block. */
export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const list = body && typeof body === 'object' && Array.isArray((body as { blocks?: unknown }).blocks) ? (body as { blocks: unknown[] }).blocks : [body];
  try {
    const blocks = await createPlannerBlocks(guard.ctx, list);
    return NextResponse.json({ blocks }, { status: 201 });
  } catch (err) {
    return plannerError(err);
  }
}
