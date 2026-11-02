import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { addTaskComment } from '@/db/repositories/compliance-tasks';
import { complianceError } from '../../../_respond';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ body: z.string().trim().min(1).max(2000), internal: z.boolean().optional() });

/** POST /api/compliances/tasks/:id/comments — staff and the client (K-2); a client's comment is never internal. */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ comment: await addTaskComment(guard.ctx, id, body.data) }, { status: 201 });
  } catch (e) {
    return complianceError(e);
  }
}
