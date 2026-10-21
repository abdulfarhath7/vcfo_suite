import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { updateOwnPassword } from '@/db/repositories/profiles';
import { getOwnPasswordChangedAt, stampOwnPasswordChanged } from '@/db/repositories/notification-prefs';
import { parseJsonBody } from '@/lib/api/parse-body';

/** GET /api/client/account/password — { changedAt } for the "changed 2 Sep" caption. */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  return NextResponse.json({ changedAt: await getOwnPasswordChangedAt(guard.ctx) });
}

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, 'password_too_short').max(128),
});

/** POST /api/client/account/password — same as /api/account/password, plus the change date. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  const result = await updateOwnPassword(guard.ctx, body.data.currentPassword, body.data.newPassword);
  if (result === 'account_not_found') return NextResponse.json({ ok: false, error: result }, { status: 404 });
  if (result === 'invalid_credentials') return NextResponse.json({ ok: false, error: result }, { status: 401 });
  const changedAt = await stampOwnPasswordChanged(guard.ctx);
  return NextResponse.json({ ok: true, changedAt });
}
