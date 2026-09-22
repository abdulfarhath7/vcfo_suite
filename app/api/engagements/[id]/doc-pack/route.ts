import { NextResponse } from 'next/server';

import { loadDocPack } from '@/lib/api/doc-pack';

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/engagements/[id]/doc-pack — readiness summary for staff. */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const loaded = await loadDocPack(id);
  if (loaded.ok === false) return loaded.response;
  return NextResponse.json({ ok: true, pack: loaded.load.summary });
}
