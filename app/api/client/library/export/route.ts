import { exportLibrary } from '@/lib/client-portal/library-api';
import { requireLibrary } from '../guard';

/** GET /api/client/library/export?ids=a,b — PDF brief of the caller's own books. */
export async function GET(request: Request) {
  const gate = await requireLibrary();
  if (gate.ok === false) return gate.response;
  return exportLibrary(gate.ctx, request);
}
