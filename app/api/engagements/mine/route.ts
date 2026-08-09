import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getMyEngagement, toAppEngagement } from '@/db/repositories/engagements';

/** GET /api/engagements/mine — client portal's assigned engagement. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const row = await getMyEngagement(guard.ctx);
  return NextResponse.json({ engagement: row ? toAppEngagement(row) : null });
}
