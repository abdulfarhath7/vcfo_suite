import { exportLibrary } from '@/lib/client-portal/library-api';
import { requireAsk } from '@/lib/ask/route-guard';

/** GET /api/ask/library/export?ids=a,b — multi-item PDF brief of the caller's own items (F3). */
export async function GET(request: Request) {
  const gate = await requireAsk();
  if (gate.ok === false) return gate.response;
  return exportLibrary(gate.ctx, request);
}
