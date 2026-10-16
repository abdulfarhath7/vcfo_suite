import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { getClientIncorporationExtras } from '@/db/repositories/client-incorporation';

/**
 * GET /api/client/incorporation[?engagementId=] — what the client Incorporation
 * pages need beyond the (client-redacted) checklist state: open file requests,
 * upload metadata, who set the incorporation window, board-resolution people.
 * Scoping is in the repository (Path A); another tenant's id reads as 404.
 */
export async function GET(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const engagementId = new URL(request.url).searchParams.get('engagementId')?.trim() || undefined;
  const extras = await getClientIncorporationExtras(guard.ctx, engagementId);
  if (!extras) return NextResponse.json({ error: 'No engagement found' }, { status: 404 });
  return NextResponse.json({ incorporation: extras });
}
