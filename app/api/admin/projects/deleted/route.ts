import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import {
  listDeletedEngagements,
  toAppEngagement,
} from '@/db/repositories/engagements';

/** GET /api/admin/projects/deleted — the recycle bin. Firm admin only. */
export async function GET() {
  const guard = await requireAnyRole('admin', 'super_admin');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const rows = await listDeletedEngagements(guard.ctx);
  return NextResponse.json({
    projects: rows.map((row) => ({
      ...toAppEngagement(row),
      deletedAt: row.deletedAt?.toISOString() ?? null,
    })),
  });
}
