import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { listRegistrationFacts } from '@/db/repositories/credentials';
import { credentialsError } from '../client/credentials/_respond';

const query = z.object({ engagementId: z.string().trim().min(1).max(80).optional() });

/**
 * GET /api/registrations?engagementId= — registration numbers, dates, certificates and
 * renewal dates by app engagement id, then by step id (G-05, G-06). A client always gets
 * its own engagement; staff get one engagement with `engagementId`, or every engagement in
 * their scope without it. Reads only the workbook's non-secret cells and the registration
 * step answers that hold these facts.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = query.safeParse({ engagementId: new URL(request.url).searchParams.get('engagementId') ?? undefined });
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  try {
    const byEngagement = await listRegistrationFacts(guard.ctx, parsed.data);
    return NextResponse.json({ ok: true, byEngagement }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return credentialsError(e);
  }
}
