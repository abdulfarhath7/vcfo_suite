import { NextResponse } from 'next/server';
import { listLibraryItems } from '@/db/repositories/client-library';
import { firmDisplayName } from '@/lib/brand';
import { toLibraryView } from '@/lib/assist/library';
import { briefFilename, renderBriefPdf } from '@/lib/assist/pdf-brief';
import { requireAssist } from '@/lib/assist/route-guard';
import { loadProjectSnapshot } from '@/lib/assist/snapshot';

/** GET /api/assist/library/export?ids=a,b — multi-item PDF brief of the caller's own items (F3). */
export async function GET(request: Request) {
  const gate = await requireAssist();
  if (gate.ok === false) return gate.response;
  const ids = new URL(request.url).searchParams.get('ids')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  try {
    const rows = (await listLibraryItems(gate.ctx)).filter((row) => ids.length === 0 || ids.includes(row.id));
    if (rows.length === 0) return NextResponse.json({ error: 'Nothing to export' }, { status: 404 });
    const loaded = await loadProjectSnapshot(gate.ctx, rows[0]!.engagementId).catch(() => null);
    const companyName = loaded?.snapshot.companyName ?? 'Your company';
    const items = rows
      .reverse()
      .map((row) => toLibraryView(row, { current: true, snapshot: loaded?.snapshot ?? null }))
      .map((view) => ({ title: view.title, answer: view.answer }));
    const pdf = await renderBriefPdf({ items, companyName, firmName: firmDisplayName() });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${briefFilename(companyName)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[assist] brief export failed', error);
    return NextResponse.json({ error: 'Could not create the PDF' }, { status: 500 });
  }
}
