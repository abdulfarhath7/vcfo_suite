import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { getRegistrationCertificateUrl } from '@/db/repositories/credentials';
import { credentialsError } from '../../client/credentials/_respond';

const query = z.object({
  engagementId: z.string().trim().min(1).max(80).optional(),
  stepId: z.string().regex(/^reg-\d{1,3}$/),
});

/**
 * GET /api/registrations/certificate?stepId=&engagementId= — a short-lived download URL
 * for one registration's certificate (G-05): the step's own upload, else the newest
 * document filed against the step that the caller may read. Clients need no
 * `engagementId`; staff must send one. 404 when there is no file to open.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const params = new URL(request.url).searchParams;
  const parsed = query.safeParse({ engagementId: params.get('engagementId') ?? undefined, stepId: params.get('stepId') ?? '' });
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  try {
    const out = await getRegistrationCertificateUrl(guard.ctx, parsed.data);
    return NextResponse.json({ ok: true, ...out }, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return credentialsError(e);
  }
}
