import { deleteLibrary, readLibraryItem } from '@/lib/client-portal/library-api';
import { requireAsk } from '@/lib/ask/route-guard';

/** GET /api/ask/library/[id] — owner read; an updated topic opens at its current version. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  return readLibraryItem(gate.ctx, id);
}

/** DELETE /api/ask/library/[id] — owner only. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  return deleteLibrary(gate.ctx, id);
}
