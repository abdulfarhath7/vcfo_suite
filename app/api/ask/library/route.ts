import { listLibrary, saveToLibrary } from '@/lib/client-portal/library-api';
import { requireAsk } from '@/lib/ask/route-guard';

/** GET /api/ask/library — the caller's saved explanations (private). Same as /api/client/library, behind the Ask flag. */
export async function GET() {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  return listLibrary(gate.ctx);
}

/** POST /api/ask/library — save an answer (content re-derived on the server). */
export async function POST(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  return saveToLibrary(gate.ctx, request);
}
