import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { listVaultRequests } from '@/db/repositories/documents';

const querySchema = z.object({ engagementId: z.string().trim().min(1).max(80) });

/**
 * GET /api/documents/requests?engagementId=… — the engagement's document requests with the
 * files sent against them, for the staff vault (G-26). New requests are made with
 * `POST /api/requests`.
 */
export async function GET(request: Request) {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }
  const parsed = querySchema.safeParse({
    engagementId: new URL(request.url).searchParams.get('engagementId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'engagementId_required' }, { status: 400 });
  }
  try {
    const requests = await listVaultRequests(auth.ctx, parsed.data.engagementId);
    return NextResponse.json({ ok: true, requests });
  } catch {
    return NextResponse.json({ ok: false, error: 'fetch_failed' }, { status: 500 });
  }
}
