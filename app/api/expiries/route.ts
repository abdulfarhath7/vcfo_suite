import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { listExpiryItems } from '@/db/repositories/expiry-items';
import { expiryError } from './_respond';

/**
 * GET /api/expiries — the expiry register in the caller's scope, soonest first. Every role's
 * compliance calendar reads it (src/components/compliances/ExpiriesCard.tsx).
 * `?withinDays=30` keeps items expiring within 30 days (and expired ones, not renewed);
 * `?engagementId=` keeps one client.
 */
export async function GET(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern', 'client');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const url = new URL(request.url);
  const within = url.searchParams.get('withinDays');
  const withinDays = within && /^\d{1,4}$/.test(within) ? Number(within) : undefined;
  try {
    const items = await listExpiryItems(guard.ctx, { withinDays, engagementId: url.searchParams.get('engagementId') });
    return NextResponse.json({ items });
  } catch (e) {
    return expiryError(e);
  }
}
