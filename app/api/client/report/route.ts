import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { firmDisplayName } from '@/lib/brand';
import { briefFilename, renderStatusBriefPdf } from '@/lib/ask/pdf-brief';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';
import { buildStatusBrief } from '@/lib/ask/status-brief';

/**
 * GET /api/client/report?engagementId= — the "Report" button on the client
 * home: this month's status PDF for the caller's own company. Same document as
 * Ask VCFO's brief, but not behind the Ask feature flags. Access runs through
 * `assertEngagementAccess` inside `loadProjectSnapshot`, so another tenant's id
 * is a 404.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  if (guard.ctx.role !== 'client' && guard.ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }
  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim();
  if (!engagementId) return NextResponse.json({ error: 'Choose a project first' }, { status: 400 });

  try {
    const now = new Date();
    const loaded = await loadProjectSnapshot(guard.ctx, engagementId, now);
    if (!loaded) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const brief = buildStatusBrief({ snapshot: loaded.snapshot, state: loaded.state, now });
    const pdf = await renderStatusBriefPdf({ brief, firmName: firmDisplayName(), now });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${briefFilename(brief.companyName, `${brief.companyName} status ${brief.monthLabel}`)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[client-report] status report failed', error);
    return NextResponse.json({ error: 'Could not create the report' }, { status: 500 });
  }
}
