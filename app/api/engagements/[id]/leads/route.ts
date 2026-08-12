import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { internIdSchema } from '@/lib/api/engagement-schemas';
import {
  addEngagementLead,
  listEngagementLeads,
  removeEngagementLead,
  replaceEngagementLead,
} from '@/db/repositories/engagement-leads';

type RouteContext = { params: Promise<{ id: string }> };

const addSchema = z.object({
  internId: internIdSchema,
});

const replaceSchema = z.object({
  fromInternId: internIdSchema,
  toInternId: internIdSchema,
});

const removeSchema = z.object({
  internId: internIdSchema,
});

/** GET /api/engagements/:id/leads — list delivery leads on a project. */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  try {
    const leads = await listEngagementLeads(guard.ctx, id);
    return NextResponse.json({ leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    const status =
      message.includes('not found') || message.includes('not permitted') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/engagements/:id/leads — add a lead, or replace one.
 * Body: { internId } to add, or { fromInternId, toInternId } to replace.
 */
export async function POST(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const json = await request.json().catch(() => null);
  if (!json || typeof json !== 'object') {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    if ('fromInternId' in json || 'toInternId' in json) {
      const body = replaceSchema.safeParse(json);
      if (!body.success) {
        return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
      }
      const leads = await replaceEngagementLead(
        guard.ctx,
        id,
        body.data.fromInternId,
        body.data.toInternId,
      );
      return NextResponse.json({ leads });
    }

    const body = addSchema.safeParse(json);
    if (!body.success) {
      return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
    }
    const leads = await addEngagementLead(guard.ctx, id, body.data.internId);
    return NextResponse.json({ leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update_failed';
    const status =
      message.includes('not found') || message.includes('not permitted')
        ? 404
        : message.includes('Not permitted')
          ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/** DELETE /api/engagements/:id/leads — body { internId } removes that lead. */
export async function DELETE(request: Request, context: RouteContext) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { id } = await context.params;
  const body = await parseJsonBody(request, removeSchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  try {
    const leads = await removeEngagementLead(guard.ctx, id, body.data.internId);
    return NextResponse.json({ leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'delete_failed';
    const status =
      message.includes('not found') || message.includes('not permitted') ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
