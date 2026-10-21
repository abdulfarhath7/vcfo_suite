import { readTopic } from '@/lib/client-portal/library-api';
import { requireLibrary } from '../../guard';

/**
 * GET /api/client/library/topic/[slug]?depth=&engagementId= — a firm topic as
 * an answer for the Library reader (no model call). Works with Ask VCFO off.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const gate = await requireLibrary();
  if (gate.ok === false) return gate.response;
  const { slug } = await params;
  return readTopic(gate.ctx, slug, request);
}
