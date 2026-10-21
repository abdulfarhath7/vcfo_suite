import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { ClientPortalForbiddenError, getClientPortalShell } from '@/db/repositories/client-portal';

/** GET /api/client/portal — the portal chrome: company, team contacts, badges, prefs. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const shell = await getClientPortalShell(guard.ctx);
    if (!shell) return NextResponse.json({ error: 'No engagement found' }, { status: 404 });
    return NextResponse.json({ shell });
  } catch (e) {
    if (e instanceof ClientPortalForbiddenError) return NextResponse.json({ error: e.message }, { status: 403 });
    throw e;
  }
}
