import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listDocuments } from '@/db/repositories/documents';
import { getFilings } from '@/db/repositories/filings';
import { documentHits, filingHits, obligationHits } from '@/lib/client-portal/search-hits';

/**
 * GET /api/client/portal/search?q=&all= — Search ⌘K hits from the caller's own
 * documents (client: shared rows only), filings and obligations (the filings
 * grouped by name), through the scoped repositories. Each filing and obligation
 * hit carries its regulator and status word for the palette's chips. Pages,
 * steps and registrations are matched in the browser from the step model.
 *
 * A query shorter than two letters returns nothing, unless `all=1` asks for
 * every record (the palette does that when a chip is set and the field is empty).
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (guard.ctx.role !== 'client') return NextResponse.json({ hits: [] });
  const params = new URL(request.url).searchParams;
  const q = (params.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  const all = params.get('all') === '1';
  if (q.length < 2 && !all) return NextResponse.json({ hits: [] });
  const term = q.length < 2 ? '' : q;
  const [docs, filings] = await Promise.all([listDocuments(guard.ctx), getFilings(guard.ctx)]);
  const now = new Date();
  return NextResponse.json({
    hits: [
      ...filingHits(filings.rows, term, now),
      ...obligationHits(filings.rows, term, now),
      ...documentHits(docs, term),
    ],
  });
}
