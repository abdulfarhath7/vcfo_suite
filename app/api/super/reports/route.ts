import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { createSavedReport, listSavedReports } from '@/db/repositories/saved-reports';
import { savedReportCreateSchema } from '@/lib/reports/saved-report-schema';

/**
 * GET  /api/super/reports — the caller's saved reports (G-21).
 * POST /api/super/reports — save the current report with its month, a schedule (none, weekly,
 * monthly) and recipients.
 *
 * Super admin only; the repository keeps every row to its owner.
 */
export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const reports = await listSavedReports(guard.ctx);
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const body = await parseJsonBody(request, savedReportCreateSchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error, issues: body.issues }, { status: 400 });
  }
  const { name, params, schedule, recipients } = body.data;
  const report = await createSavedReport(guard.ctx, {
    name,
    params: { month: params.month ?? 'latest' },
    schedule,
    recipients,
  });
  return NextResponse.json({ report }, { status: 201 });
}
