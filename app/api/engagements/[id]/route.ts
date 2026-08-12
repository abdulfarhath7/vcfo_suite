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
import {
  ensureEngagementManager,
  removeEngagementManager,
} from '@/db/repositories/engagement-managers-membership';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import { isFirmWideAdmin } from '@/lib/auth';
import { emptyEmailDispatch } from '@/lib/email/email-dispatch';
import { notifyTeamAssignment } from '@/lib/email/notify-team-assignment';
import { db } from '@/db/client';
import { profiles } from '@/db/schema';
import { eq } from 'drizzle-orm';

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

async function profileParty(id: string | null | undefined) {
  if (!id) return null;
  const [row] = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, id))
    .limit(1);
  if (!row?.email?.trim()) return null;
  return {
    userId: row.id,
    email: row.email.trim(),
    name: row.name?.trim() || row.email.trim(),
  };
}

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
    const before = await getEngagementById(guard.ctx, engagementDbId(id));
    if (!before) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

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
    const engagement = toAppEngagement(row);
    const email = emptyEmailDispatch();

    if (body.data.managerId !== undefined) {
      const prevId = before.managerId;
      const nextId = body.data.managerId;
      const actor = {
        userId: guard.ctx.userId,
        name: guard.ctx.name,
        email: guard.ctx.email,
      };

      if (prevId && prevId !== nextId) {
        await removeEngagementManager({
          engagementDbId: row.id,
          managerId: prevId,
        }).catch(() => undefined);
        const prev = await profileParty(prevId);
        if (prev) {
          const part = await notifyTeamAssignment({
            engagementAppId: engagement.id,
            engagementSlug: engagement.slug,
            companyName: engagement.companyName,
            role: 'project manager',
            party: prev,
            action: 'removed',
            actor,
          });
          email.attempted += part.attempted;
          email.sent.push(...part.sent);
          email.skipped.push(...part.skipped);
          email.failed.push(...part.failed);
        }
      }

      if (nextId) {
        await ensureEngagementManager({
          engagementDbId: row.id,
          managerId: nextId,
          invitedBy: guard.ctx.userId,
        });
        if (nextId !== prevId) {
          const next = await profileParty(nextId);
          if (next) {
            const part = await notifyTeamAssignment({
              engagementAppId: engagement.id,
              engagementSlug: engagement.slug,
              companyName: engagement.companyName,
              role: 'project manager',
              party: next,
              action: 'assigned',
              actor,
            });
            email.attempted += part.attempted;
            email.sent.push(...part.sent);
            email.skipped.push(...part.skipped);
            email.failed.push(...part.failed);
          }
        }
      }
    }

    email.sent = [...new Set(email.sent)];
    email.skipped = [...new Set(email.skipped)];
    email.failed = [...new Set(email.failed)];

    return NextResponse.json({ engagement, email });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed';
    const status = message.includes('not found') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
