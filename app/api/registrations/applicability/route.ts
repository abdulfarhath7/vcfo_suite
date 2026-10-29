import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { getComplianceStarts } from '@/db/repositories/registration-applicability';

const query = z.object({ engagementId: z.string().trim().min(1).max(80).optional() });

/**
 * GET /api/registrations/applicability?engagementId= — why each registration applies (the
 * rule and the client's stored questionnaire answers), the obligations it starts with the
 * stored trigger date, and the obligations the engagement will carry once incorporated
 * (C-395, C-426, C-500, S-813, S-814). A client reads its own engagement without the id.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = query.safeParse({ engagementId: new URL(request.url).searchParams.get('engagementId') ?? undefined });
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  try {
    const starts = await getComplianceStarts(guard.ctx, parsed.data.engagementId);
    if (!starts) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    return NextResponse.json({ ok: true, starts }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    console.error('[registrations/applicability] failed', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
  }
}
