import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/auth/guards';
import { renderPartnerReportPdf } from '@/lib/reports/render-partner-report';
import { pdfQuerySchema } from '@/lib/reports/saved-report-schema';

/**
 * GET /api/super/reports/pdf?month=YYYY-MM|latest — the partner report the Reports page shows,
 * as a PDF download (G-21). Same data as the page: `getSuperFirmInsights` under the caller's
 * context. Super admin only.
 */
export async function GET(request: Request) {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const url = new URL(request.url);
  const query = pdfQuerySchema.safeParse({ month: url.searchParams.get('month') ?? undefined });
  if (!query.success) {
    return NextResponse.json({ error: 'invalid_month' }, { status: 400 });
  }
  try {
    const rendered = await renderPartnerReportPdf(guard.ctx, { month: query.data.month });
    if (!rendered) return NextResponse.json({ error: 'No report for that month' }, { status: 404 });
    return new NextResponse(new Uint8Array(rendered.pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${rendered.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[reports] pdf failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Could not create the PDF' }, { status: 500 });
  }
}
