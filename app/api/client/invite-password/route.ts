import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { systemPeekInviteToken, systemSetInvitePassword } from '@/db/repositories/client-team';

/**
 * C-899: the set-password link of a client invite. Public on purpose: the person has no
 * password yet, and the link token is the authority (`client-team.ts`, one use, seven days).
 *
 * GET  /api/client/invite-password?token=… → { email, companyName } or 404 for a bad link.
 * POST /api/client/invite-password { token, password } → { ok: true, email } or 400.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const out = await systemPeekInviteToken(token);
  if (!out) return NextResponse.json({ error: 'This link is invalid or has expired' }, { status: 404 });
  return NextResponse.json(out);
}

const bodySchema = z.object({ token: z.string().min(32).max(128), password: z.string().min(8, 'Use at least 8 characters').max(128) });

export async function POST(request: Request) {
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const out = await systemSetInvitePassword(body.data.token, body.data.password);
  if (out.status === 'ok') return NextResponse.json({ ok: true, email: out.email });
  return NextResponse.json(
    { error: out.status === 'too_short' ? 'Use at least 8 characters' : 'This link is invalid or has expired' },
    { status: 400 },
  );
}
