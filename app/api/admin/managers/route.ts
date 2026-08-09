import { NextResponse } from 'next/server';
import { requireAdminOrManager } from '@/auth/guards';
import { listManagerOptions } from '@/db/repositories/profiles';

/** GET /api/admin/managers — picker list for project create (admin). */
export async function GET() {
  const auth = await requireAdminOrManager();
  if (auth.ok === false) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const managers = await listManagerOptions(auth.ctx);
  return NextResponse.json({ managers });
}
