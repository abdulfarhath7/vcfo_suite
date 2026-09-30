import { NextResponse } from 'next/server';
import { firmDisplayName } from '@/lib/brand';
import { askFeatures } from '@/lib/ask/config';
import { briefFilename, renderStatusBriefPdf } from '@/lib/ask/pdf-brief';
import { requireAsk } from '@/lib/ask/route-guard';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';
import { buildStatusBrief } from '@/lib/ask/status-brief';

/**
 * GET /api/ask/brief?engagementId= — C4 monthly status brief (PDF download).
 * A draft for the client to forward; never emailed by the app.
 */
export async function GET(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  if (!askFeatures().C4) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (gate.ctx.role !== 'client' && gate.ctx.role !== 'super_admin') {
    return NextResponse.json({ error: 'Not available' }, { status: 403 });
  }
  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim();
  if (!engagementId) return NextResponse.json({ error: 'Choose a project first' }, { status: 400 });
  try {
    const now = new Date();
    const loaded = await loadProjectSnapshot(gate.ctx, engagementId, now);
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
    console.error('[ask-vcfo] status brief failed', error);
    return NextResponse.json({ error: 'Could not create the PDF' }, { status: 500 });
  }
}
