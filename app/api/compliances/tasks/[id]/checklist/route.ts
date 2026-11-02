import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { addChecklistItem } from '@/db/repositories/compliance-tasks';
import { complianceError } from '../../../_respond';

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ label: z.string().trim().min(1).max(200) });

/** POST /api/compliances/tasks/:id/checklist — add a subtask (staff). */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ item: await addChecklistItem(guard.ctx, id, body.data.label) }, { status: 201 });
  } catch (e) {
    return complianceError(e);
  }
}
