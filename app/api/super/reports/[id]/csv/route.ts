import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/auth/guards';
import { getSavedReport } from '@/db/repositories/saved-reports';
import { renderPartnerReportCsv } from '@/lib/reports/render-partner-report';

/**
 * GET /api/super/reports/:id/csv — a saved report as a CSV file that Excel opens, with its
 * saved month (P-225). Own rows only; super admin only.
 */
type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const report = await getSavedReport(guard.ctx, id);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  try {
    const rendered = await renderPartnerReportCsv(guard.ctx, report.params);
    if (!rendered) return NextResponse.json({ error: 'No report for that month' }, { status: 404 });
    return new NextResponse(new Uint8Array(rendered.csv), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${rendered.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[reports] saved csv failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not create the file' }, { status: 500 });
  }
}
