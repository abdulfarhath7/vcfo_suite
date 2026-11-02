import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/auth/guards';
import { listDemoRequests } from '@/db/repositories/demo-requests';

/**
 * GET /api/super/growth/demo-requests — the "Book a demo" requests from the public site
 * (G-30), newest first, for the Growth screen. Super admin only. "Add as prospect" posts
 * `{ demoRequestId }` to `/api/super/growth/prospects`.
 */
export async function GET() {
  const guard = await requireSuperAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const requests = await listDemoRequests(guard.ctx);
  return NextResponse.json({ requests });
}
