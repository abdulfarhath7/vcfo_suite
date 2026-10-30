import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { getStatutoryDetail, updateStatutory } from '@/db/repositories/compliance-statutory';
import { complianceError, profileId, stage } from '../../_respond';

type RouteContext = { params: Promise<{ instanceId: string }> };

/** GET /api/compliances/statutory/:instanceId — the statutory detail page payload (D-1 to D-4). */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { instanceId } = await context.params;
  try {
    return NextResponse.json({ detail: await getStatutoryDetail(guard.ctx, instanceId) });
  } catch (e) {
    return complianceError(e);
  }
}

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('stage'), stage }),
  z.object({ action: z.literal('submit') }),
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('send-back'), note: z.string().trim().min(1).max(500) }),
  z.object({ action: z.literal('assign'), ownerId: profileId.nullable().optional(), reviewerId: profileId.nullable().optional() }),
]);

/** PATCH /api/compliances/statutory/:instanceId — the workflow of one statutory item (staff). */
export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { instanceId } = await context.params;
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    return NextResponse.json({ detail: await updateStatutory(guard.ctx, instanceId, body.data) });
  } catch (e) {
    return complianceError(e);
  }
}
