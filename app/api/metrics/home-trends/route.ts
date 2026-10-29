import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireDeveloper } from '@/auth/guards';
import { HomeTrendsError, getHomeTrends } from '@/db/repositories/home-trends';
import { HOME_TREND_HOMES } from '@/lib/metrics/home-trends';
import { getHomeTileTrends } from '@/db/repositories/home-tile-stamps';
import { STAMP_HOMES, type StampHome } from '@/lib/metrics/home-tile-stamps';

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
 * On the lead, manager and admin homes the tiles with no rebuilt past also get the values the
 * person's own home stamped on earlier days (`home-tile-stamps.ts`); a rebuilt series wins.
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
    const home = query.data.home;
    const trends = await getHomeTrends(guard.ctx, home, { engagementId: query.data.engagementId });
    if ((STAMP_HOMES as string[]).includes(home)) {
      const stamped = await getHomeTileTrends(guard.ctx, home as StampHome);
      return NextResponse.json({ trends: { ...stamped, ...trends } });
    }
    return NextResponse.json({ trends });
  } catch (err) {
    if (err instanceof HomeTrendsError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
