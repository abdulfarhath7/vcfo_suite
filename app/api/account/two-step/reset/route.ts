import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/auth/guards';
import { resetTwoStepFor } from '@/db/repositories/profiles';
import { parseJsonBody } from '@/lib/api/parse-body';

const bodySchema = z.object({ profileId: z.string().uuid() });

const STATUS = { forbidden: 403, not_found: 404, self: 400 } as const;

/**
 * POST /api/account/two-step/reset — a firm admin or the super admin turns off
 * another person's two-step sign-in (lost phone, or after AUTH_SECRET rotated).
 */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: 400 });
  const result = await resetTwoStepFor(guard.ctx, body.data.profileId);
  if (result !== 'ok') return NextResponse.json({ error: result }, { status: STATUS[result] });
  return NextResponse.json({ ok: true });
}
