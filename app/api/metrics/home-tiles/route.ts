import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { parseJsonBody } from '@/lib/api/parse-body';
import { HomeTileStampError, stampHomeTiles } from '@/db/repositories/home-tile-stamps';
import { STAMP_HOMES, type StampHome } from '@/lib/metrics/home-tile-stamps';

const bodySchema = z.object({
  home: z.enum(STAMP_HOMES as [StampHome, ...StampHome[]]),
  values: z.record(z.string(), z.number()),
});

/**
 * POST /api/metrics/home-tiles `{ home: 'lead'|'manager'|'admin', values: { [tile]: number } }`
 * — stores the numbers the caller's home tiles show today (F-071, F-072). The repository checks
 * the role per home, keeps only the known tile keys and writes under the caller's own profile
 * id. `GET /api/metrics/home-trends` returns them as trend lines from the next day on.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const saved = await stampHomeTiles(guard.ctx, body.data.home, body.data.values);
    return NextResponse.json({ saved });
  } catch (err) {
    if (err instanceof HomeTileStampError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
