import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import { listRegisteredOfficeNocs } from '@/db/repositories/registered-office-noc';

/** GET /api/registered-office-nocs — every registered-office NOC in the caller's book (staff; clients get none). */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ nocs: await listRegisteredOfficeNocs(guard.ctx) });
}
