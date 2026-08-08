import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { updateOwnPassword } from '@/db/repositories/profiles';
import { parseJsonBody } from '@/lib/api/parse-body';

const bodySchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8, 'password_too_short').max(128),
});

/** POST /api/account/password — authenticated user changes their own password. */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) {
    return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  }

  const result = await updateOwnPassword(
    auth.ctx,
    body.data.currentPassword,
    body.data.newPassword,
  );

  if (result === 'account_not_found') {
    return NextResponse.json({ ok: false, error: result }, { status: 404 });
  }
  if (result === 'invalid_credentials') {
    return NextResponse.json({ ok: false, error: result }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
