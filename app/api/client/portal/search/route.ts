import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listDocuments } from '@/db/repositories/documents';
import { getFilings } from '@/db/repositories/filings';

/**
 * GET /api/client/portal/search?q= — Search ⌘K hits from the caller's own
 * documents (client: shared rows only) and filings, through the scoped
 * repositories. Pages and steps are matched in the browser.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (guard.ctx.role !== 'client') return NextResponse.json({ hits: [] });
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const [docs, filings] = await Promise.all([listDocuments(guard.ctx), getFilings(guard.ctx)]);
  const docHits = docs
    .filter((d) => d.fileName.toLowerCase().includes(q))
    .slice(0, 12)
    .map((d) => ({ group: 'Documents', title: d.fileName, href: `/app/client/documents?doc=d-${encodeURIComponent(d.id)}` }));
  const filingHits = filings.rows
    .filter((f) => `${f.particular} ${f.compliance} ${f.periodLabel ?? ''}`.toLowerCase().includes(q))
    .slice(0, 12)
    .map((f) => ({
      group: 'Filings',
      title: f.particular,
      meta: [f.periodLabel, f.dueDate].filter(Boolean).join(' · '),
      href: `/app/client/compliances/filings?filing=${encodeURIComponent(f.id)}`,
    }));
  return NextResponse.json({ hits: [...docHits, ...filingHits] });
}
