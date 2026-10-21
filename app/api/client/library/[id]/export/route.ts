import { NextResponse } from 'next/server';
import { exportLibraryItem } from '@/lib/client-portal/library-api';
import { requireLibrary } from '../../guard';

/** GET /api/client/library/[id]/export — single-book PDF brief, owner only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireLibrary();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return exportLibraryItem(gate.ctx, id);
}
