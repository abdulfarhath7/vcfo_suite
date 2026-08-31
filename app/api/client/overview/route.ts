import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getClientOverview } from '@/db/repositories/client-overview';

/**
 * GET /api/client/overview — the single scoped read behind the client
 * mission-control dashboard.
 *
 * `?engagementId=` is optional: without it the caller gets their own first
 * scoped engagement. With it, the repository still runs `assertEngagementAccess`,
 * so a client asking for someone else's engagement gets 404 (never 200 with
 * another tenant's data, and never a 403 that would confirm the id exists).
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const engagementId = new URL(request.url).searchParams.get('engagementId') ?? undefined;
  const overview = await getClientOverview(guard.ctx, engagementId);

  if (!overview) {
    return NextResponse.json({ error: 'No engagement found' }, { status: 404 });
  }

  return NextResponse.json({ overview });
}
