import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/guards';
import { publicErrorMessage } from '@/lib/api-error';
import { getFirmConnection } from '@/db/repositories/integrations';
import { queueZohoDiscover } from '@/lib/integrations/zoho/run-discover';

/** POST /api/integrations/zoho/discover — run discovery, the auto map and the field check again. */
export async function POST() {
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    const conn = await getFirmConnection(guard.ctx);
    if (!conn) return NextResponse.json({ error: 'zoho_not_connected' }, { status: 409 });
    const job = await queueZohoDiscover(conn.id, guard.ctx.userId);
    if (!job) return NextResponse.json({ error: 'Discovery is already running' }, { status: 409 });
    return NextResponse.json({ ok: true, ...job });
  } catch (err) {
    return NextResponse.json({ error: publicErrorMessage(err, 'discover_failed') }, { status: 500 });
  }
}
