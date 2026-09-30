import { NextResponse } from 'next/server';
import { getLibraryItem } from '@/db/repositories/client-library';
import { firmDisplayName } from '@/lib/brand';
import { toLibraryView } from '@/lib/ask/library';
import { briefFilename, renderBriefPdf } from '@/lib/ask/pdf-brief';
import { requireAsk } from '@/lib/ask/route-guard';
import { loadProjectSnapshot } from '@/lib/ask/snapshot';

/** GET /api/ask/library/[id]/export — single-item PDF brief, owner only (F3). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  try {
    const row = await getLibraryItem(gate.ctx, id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const loaded = await loadProjectSnapshot(gate.ctx, row.engagementId).catch(() => null);
    const companyName = loaded?.snapshot.companyName ?? 'Your company';
    const view = toLibraryView(row, { current: true, snapshot: loaded?.snapshot ?? null });
    const pdf = await renderBriefPdf({
      items: [{ title: view.title, answer: view.answer }],
      companyName,
      firmName: firmDisplayName(),
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${briefFilename(companyName, view.title)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[ask-vcfo] brief export failed', error);
    return NextResponse.json({ error: 'Could not create the PDF' }, { status: 500 });
  }
}
