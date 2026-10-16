import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { ClientPortalForbiddenError, getTeamPhotoKey } from '@/db/repositories/client-portal';
import { sniffImageContentType } from '@/lib/account-avatar';
import { getObjectBuffer } from '@/storage/s3';

/** GET /api/client/portal/team-photo/[id] — a team member's photo, for clients on that person's engagement only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const { id } = await params;
  try {
    const key = await getTeamPhotoKey(guard.ctx, id);
    if (!key) return new NextResponse(null, { status: 404 });
    const bytes = await getObjectBuffer(key);
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: { 'Content-Type': sniffImageContentType(bytes) ?? 'image/jpeg', 'Cache-Control': 'private, max-age=300' },
    });
  } catch (e) {
    if (e instanceof ClientPortalForbiddenError) return new NextResponse(null, { status: 403 });
    throw e;
  }
}
