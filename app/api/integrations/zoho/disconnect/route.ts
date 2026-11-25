import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/guards';
import { publicErrorMessage } from '@/lib/api-error';
import { disconnectFirmConnection } from '@/db/repositories/integrations';

/** POST /api/integrations/zoho/disconnect — revoke the refresh token at Zoho and retire the connection. */
export async function POST() {
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const r = await disconnectFirmConnection(guard.ctx);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'disconnect_failed') }, { status: 500 });
  }
}
