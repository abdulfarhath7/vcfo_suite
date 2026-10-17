import { listLibrary, saveToLibrary } from '@/lib/client-portal/library-api';
import { requireLibrary } from './guard';

/** GET /api/client/library — the caller's saved books (private). Works with Ask VCFO off. */
export async function GET() {
  const gate = await requireLibrary();
  if (gate.ok === false) return gate.response;
  return listLibrary(gate.ctx);
}

/** POST /api/client/library { engagementId, topicSlug + answer | messageId } — save a book. */
export async function POST(request: Request) {
  const gate = await requireLibrary();
  if (gate.ok === false) return gate.response;
  return saveToLibrary(gate.ctx, request);
}
