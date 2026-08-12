import { NextResponse } from 'next/server';
import { assertEngagementProgressCcAccess } from '@/lib/api/engagement-progress-cc-access';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requireRole } from '@/lib/api/require-role';
import { progressCcPatchBodySchema } from '@/lib/api/schemas';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { hasDefaultProgressCcConfigured } from '@/lib/email/merge-cc';
import {
  getEngagementById,
  updateProgressCcEmails,
} from '@/db/repositories/engagements';

type RouteContext = { params: Promise<{ id: string }> };

function normalizeProgressCcRow(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((e) => {
    if (typeof e !== 'string') return [];
    const trimmed = e.trim().toLowerCase();
    return trimmed ? [trimmed] : [];
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const { id: engagementParam } = await context.params;

  const access = await assertEngagementProgressCcAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const row = await getEngagementById(auth.ctx, access.dbId);
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    emails: normalizeProgressCcRow(row.progressCcEmails),
    defaultCcConfigured: hasDefaultProgressCcConfigured(),
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireRole(['admin', 'manager', 'intern']);
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const [body, { id: engagementParam }] = await Promise.all([
    parseJsonBody(request, progressCcPatchBodySchema),
    context.params,
  ]);
  if (body.ok === false) {
    return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  }

  const access = await assertEngagementProgressCcAccess(auth.ctx, engagementParam);
  if (access.notFound) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  if (access.forbidden) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  try {
    const emails = await updateProgressCcEmails(auth.ctx, access.dbId, body.data.emails);

    await recordAuditEvent(auth.ctx, {
      engagementId: engagementParam,
      action: 'engagement.progress_cc_update',
      summary: `Updated progress email CC list (${body.data.emails.length} address${body.data.emails.length === 1 ? '' : 'es'})`,
      metadata: { emails: body.data.emails },
      actorEmail: auth.ctx.email,
      actorName: auth.ctx.name,
    });

    return NextResponse.json({
      ok: true,
      emails: normalizeProgressCcRow(emails),
      defaultCcConfigured: hasDefaultProgressCcConfigured(),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  }
}
