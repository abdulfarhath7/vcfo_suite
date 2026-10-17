import { exportLibraryItem } from '@/lib/client-portal/library-api';
import { requireAsk } from '@/lib/ask/route-guard';

/** GET /api/ask/library/[id]/export — single-item PDF brief, owner only (F3). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  const { id } = await params;
  return exportLibraryItem(gate.ctx, id);
}
