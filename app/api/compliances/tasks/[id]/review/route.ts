import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { reviewTask } from '@/db/repositories/compliance-tasks';
import { complianceError } from '../../../_respond';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ decision: z.enum(['approve', 'send-back']), note: z.string().max(500).optional() });

/** POST /api/compliances/tasks/:id/review — approve or send back a submitted task. */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ task: await reviewTask(guard.ctx, id, body.data) });
  } catch (e) {
    return complianceError(e);
  }
}
