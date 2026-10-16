import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { updateCredentialCell } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';
import { credentialsError, engagementParam } from '../_respond';

const body = z.object({
  key: z.string().min(5).max(240),
  value: z.string().max(2000),
  restore: z.object({ edited: z.boolean() }).optional(),
});

/** PATCH /api/client/credentials/cells — save one cell (needs a live Edit grant); `restore` = Undo. */
export async function PATCH(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const credentials = await updateCredentialCell(guard.ctx, { ...parsed.data, engagementId: engagementParam(request) });
    return NextResponse.json({ ok: true, credentials });
  } catch (e) {
    return credentialsError(e);
  }
}
