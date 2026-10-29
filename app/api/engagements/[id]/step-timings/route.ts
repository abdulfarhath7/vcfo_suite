import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { getStepTimings } from '@/db/repositories/step-events';

type RouteContext = { params: Promise<{ id: string }> };

const querySchema = z.object({ stepId: z.string().trim().min(1).max(80).optional() });

/**
 * GET /api/engagements/:id/step-timings[?stepId=] — opened at, finished at and days in step
 * per step, from `engagement_step_events` (G-13). Staff only, scoped like engagements: an
 * engagement outside the caller's scope answers 404.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  const url = new URL(request.url);
  const query = querySchema.safeParse({ stepId: url.searchParams.get('stepId') ?? undefined });
  if (!query.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const access = await assertEngagementAccess(guard.ctx, id);
  if (!access.ok) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const steps = await getStepTimings(guard.ctx, access.dbId);
  const stepId = query.data.stepId;
  return NextResponse.json({ steps: stepId ? { [stepId]: steps[stepId] ?? null } : steps });
}
