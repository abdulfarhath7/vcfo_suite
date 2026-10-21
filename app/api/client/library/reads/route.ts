import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { LibraryPortalForbiddenError, listRecentReads, recordReadProgress } from '@/db/repositories/client-library-portal';

/** GET /api/client/library/reads — the caller's reading progress, most recent first. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    return NextResponse.json({ reads: await listRecentReads(guard.ctx, 20) });
  } catch (e) {
    console.error('[client-library] reads failed', e);
    return NextResponse.json({ error: 'Could not load reading progress' }, { status: 500 });
  }
}

/** POST /api/client/library/reads { itemId? | topicSlug?, sectionsRead, sectionsTotal } */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  try {
    const read = await recordReadProgress(guard.ctx, {
      itemId: typeof body.itemId === 'string' && /^[0-9a-f-]{36}$/i.test(body.itemId) ? body.itemId : null,
      topicSlug: typeof body.topicSlug === 'string' ? body.topicSlug.slice(0, 120) : null,
      sectionsRead: num(body.sectionsRead),
      sectionsTotal: num(body.sectionsTotal),
    });
    if (!read) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ read });
  } catch (e) {
    if (e instanceof LibraryPortalForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    console.error('[client-library] record read failed', e);
    return NextResponse.json({ error: 'Could not save reading progress' }, { status: 500 });
  }
}
