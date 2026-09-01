import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getFilings } from '@/db/repositories/filings';
import { parseFyParam } from '@/lib/filings';

/**
 * GET /api/filings — the compliance register for whatever this caller may see.
 *
 * One route for all five roles: `getFilings` scopes by `AuthContext`, so a
 * client gets their own company and an admin gets the firm. `?engagementId=`
 * narrows within that scope and is access-checked, never trusted.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const params = new URL(request.url).searchParams;
  const result = await getFilings(guard.ctx, {
    engagementId: params.get('engagementId') ?? undefined,
    fyStartYear: parseFyParam(params.get('fy')) ?? undefined,
  });

  return NextResponse.json(result);
}
