import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listEmailDirectory } from '@/db/repositories/email-directory';

/** GET /api/outlook/directory — staff recipients for in-app Outlook compose. */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const people = await listEmailDirectory(guard.ctx);
    return NextResponse.json({ people });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'directory_failed';
    const status = message.includes('not permitted') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
