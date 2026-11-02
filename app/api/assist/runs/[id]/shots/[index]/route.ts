import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { readAssistShot } from '@/db/repositories/assist-runs';

type RouteContext = { params: Promise<{ id: string; index: string }> };

/**
 * GET /api/assist/runs/[id]/shots/[index] — the screenshot VCFO Assist kept of one step,
 * for "View replay". Same scope as the runs (staff on their engagements, a client on its own).
 */
export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id, index } = await context.params;
  const shot = await readAssistShot(guard.ctx, id, Number(index));
  if (!shot) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return new NextResponse(new Uint8Array(shot.bytes), {
    status: 200,
    headers: {
      'Content-Type': shot.contentType,
      'Content-Length': String(shot.bytes.length),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
