import { NextResponse } from 'next/server';
import { deleteLibraryItem, getLibraryItem } from '@/db/repositories/client-library';
import { toLibraryView, UPDATED_SINCE_SAVED } from '@/lib/assist/library';
import { requireAssist } from '@/lib/assist/route-guard';
import { loadProjectSnapshot } from '@/lib/assist/snapshot';

/** GET /api/assist/library/[id] — owner read; an updated topic opens at its current version. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAssist();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  try {
    const row = await getLibraryItem(gate.ctx, id);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const loaded = await loadProjectSnapshot(gate.ctx, row.engagementId).catch(() => null);
    const view = toLibraryView(row, { current: true, snapshot: loaded?.snapshot ?? null });
    return NextResponse.json({ item: view, notice: view.updated ? UPDATED_SINCE_SAVED : null });
  } catch (error) {
    console.error('[assist] library read failed', error);
    return NextResponse.json({ error: 'Could not open this item' }, { status: 500 });
  }
}

/** DELETE /api/assist/library/[id] — owner only. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAssist();
  if (gate.ok === false) return gate.response;
  if (gate.ctx.role !== 'client') return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  const { id } = await params;
  try {
    const removed = await deleteLibraryItem(gate.ctx, id);
    if (!removed) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[assist] library delete failed', error);
    return NextResponse.json({ error: 'Could not remove this item' }, { status: 500 });
  }
}
