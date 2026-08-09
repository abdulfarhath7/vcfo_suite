import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import {
  engagementHealthSchema,
  engagementStageSchema,
  internIdSchema,
} from '@/lib/api/engagement-schemas';
import { entityLegalFormSchema } from '@/lib/api/schemas';
import {
  getEngagementById,
  toAppEngagement,
  updateEngagement,
} from '@/db/repositories/engagements';
import { listManagerOptions } from '@/db/repositories/profiles';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { isFirmWideAdmin } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

const patchBodySchema = z.object({
  companyName: z.string().trim().min(1).max(120).optional(),
  /** Pass null to unassign the delivery lead. */
  internId: z.union([internIdSchema, z.null()]).optional(),
  /** Pass null to unassign the project manager (admin only). */
  managerId: z.union([z.string().uuid(), z.null()]).optional(),
  stage: engagementStageSchema.optional(),
  health: engagementHealthSchema.optional(),
  incorporationDate: z.string().trim().nullable().optional(),
  entityLegalForm: entityLegalFormSchema.optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const row = await getEngagementById(guard.ctx, engagementDbId(id));
  if (!row) {
    return NextResponse.json({ engagement: null }, { status: 404 });
  }

  return NextResponse.json({ engagement: toAppEngagement(row) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('admin', 'manager', 'intern', 'super_admin');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await parseJsonBody(request, patchBodySchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  try {
    const patch: Parameters<typeof updateEngagement>[2] = {};
    if (body.data.companyName !== undefined) patch.companyName = body.data.companyName;
    if (body.data.internId !== undefined) patch.internId = body.data.internId;
    if (body.data.managerId !== undefined) {
      if (!isFirmWideAdmin(guard.ctx.role)) {
        return NextResponse.json({ error: 'manager_reassign_admin_only' }, { status: 403 });
      }
      if (body.data.managerId !== null) {
        const managers = await listManagerOptions(guard.ctx);
        if (!managers.some((m) => m.id === body.data.managerId)) {
          return NextResponse.json({ error: 'manager_not_found' }, { status: 400 });
        }
      }
      patch.managerId = body.data.managerId;
    }
    if (body.data.stage !== undefined) patch.stage = body.data.stage;
    if (body.data.health !== undefined) patch.health = body.data.health;
    if (body.data.entityLegalForm !== undefined) patch.entityLegalForm = body.data.entityLegalForm;
    if (body.data.incorporationDate !== undefined) {
      patch.incorporationDate = body.data.incorporationDate;
    }

    const row = await updateEngagement(guard.ctx, engagementDbId(id), patch);
    return NextResponse.json({ engagement: toAppEngagement(row) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
