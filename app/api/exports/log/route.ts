import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAnyRole } from '@/auth/guards';
import { recordExport } from '@/lib/exports/record-export';

const MAX_CHARS = 5 * 1024 * 1024;
const Body = z.object({
  kind: z.literal('audit_log'),
  fileName: z.string().trim().min(1).max(120),
  csv: z.string().max(MAX_CHARS),
});

/**
 * POST /api/exports/log: log an export the browser built (the staff audit log CSV, P-373),
 * keep its copy under `exports/` for 30 days, and answer 204. Staff only; the row is the
 * caller's own. A failure to log never blocks the download, which already happened.
 */
export async function POST(request: Request) {
  const guard = await requireAnyRole('super_admin', 'admin', 'manager', 'intern');
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  await recordExport(guard.ctx, { kind: 'audit_log', format: 'csv', fileName: parsed.data.fileName, body: parsed.data.csv });
  return new NextResponse(null, { status: 204 });
}
