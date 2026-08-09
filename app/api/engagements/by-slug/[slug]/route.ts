import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getEngagementBySlug, toAppEngagement } from '@/db/repositories/engagements';

type RouteContext = { params: Promise<{ slug: string }> };

/** GET /api/engagements/by-slug/:slug */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const { slug } = await context.params;
  const row = await getEngagementBySlug(guard.ctx, slug);
  return NextResponse.json({ engagement: row ? toAppEngagement(row) : null });
}
