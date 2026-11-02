import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listRecentWhatsAppDeliveries } from '@/db/repositories/notification-deliveries';

/** GET /api/whatsapp/sends — recent WhatsApp deliveries on the caller's engagements. */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  try {
    return NextResponse.json({ sends: await listRecentWhatsAppDeliveries(guard.ctx, 30) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'sends_failed' }, { status: 500 });
  }
}
