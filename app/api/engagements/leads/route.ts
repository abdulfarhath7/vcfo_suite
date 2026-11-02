import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listBookLeads } from '@/db/repositories/book-leads';

/**
 * GET /api/engagements/leads — every project lead across the caller's book,
 * with names (one read instead of one `/api/engagements/:id/leads` per client).
 * Scoped by `listBookLeads` (Path A); clients are refused.
 */
export async function GET() {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const leads = await listBookLeads(guard.ctx);
    return NextResponse.json({ leads });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    const status = message.includes('not permitted') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
