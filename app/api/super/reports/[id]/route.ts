import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { deleteSavedReport, getSavedReport, updateSavedReport } from '@/db/repositories/saved-reports';
import { savedReportPatchSchema } from '@/lib/reports/saved-report-schema';

/**
 * PATCH  /api/super/reports/:id — rename, change the month, the schedule or the recipients.
 * DELETE /api/super/reports/:id — remove a saved report.
 *
 * Super admin only, own rows only: another owner's id answers 404 (G-21).
 */
type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const body = await parseJsonBody(request, savedReportPatchSchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error, issues: body.issues }, { status: 400 });
  }
  const patch = body.data;
  if (patch.schedule && patch.schedule !== 'none' && patch.recipients === undefined) {
    const current = await getSavedReport(guard.ctx, id);
    if (!current) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    if (current.recipients.length === 0) {
      return NextResponse.json({ error: 'Add at least one recipient for a schedule' }, { status: 400 });
    }
  }
  const report = await updateSavedReport(guard.ctx, id, {
    name: patch.name,
    params: patch.params ? { month: patch.params.month ?? 'latest' } : undefined,
    schedule: patch.schedule,
    recipients: patch.recipients,
  });
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json({ report });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const removed = await deleteSavedReport(guard.ctx, id);
  if (!removed) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
