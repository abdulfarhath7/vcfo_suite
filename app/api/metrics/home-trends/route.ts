import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireDeveloper } from '@/auth/guards';
import { HomeTrendsError, getHomeTrends } from '@/db/repositories/home-trends';
import { HOME_TREND_HOMES } from '@/lib/metrics/home-trends';

const querySchema = z.object({
  home: z.enum(HOME_TREND_HOMES),
  engagementId: z.string().trim().min(1).max(100).optional(),
});

/**
 * GET /api/metrics/home-trends?home=lead|manager|admin|super|dev|client[&engagementId=] — the
 * past values behind the home card trend lines (R-18, C-0122): `{ trends: { [tileKey]: number[] } }`,
 * oldest first, without today. The screen appends the live count. A tile whose past cannot be
 * rebuilt from stored rows has no key. The developer home signs in through the developer guard;
 * every other home through the normal session, and the repository checks the role per home.
 * Daily homes cover the 30 days before today. On the lead, manager and admin homes the
 * repository lays the values the person's own home stamped (`home-tile-stamps.ts`) over the
 * rebuilt days; a stamp wins for its day.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = querySchema.safeParse({
    home: url.searchParams.get('home') ?? undefined,
    engagementId: url.searchParams.get('engagementId') ?? undefined,
  });
  if (!query.success) {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const guard = query.data.home === 'dev' ? await requireDeveloper() : await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const trends = await getHomeTrends(guard.ctx, query.data.home, { engagementId: query.data.engagementId });
    return NextResponse.json({ trends });
  } catch (err) {
    if (err instanceof HomeTrendsError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
