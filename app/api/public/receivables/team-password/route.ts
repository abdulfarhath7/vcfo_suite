import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { systemPeekTeamToken, systemSetTeamPassword } from '@/db/repositories/receivables';

/**
 * The set-password link of a receivables team member's new login (owner, 20 Nov 2026). Public on
 * purpose: the member has no password yet, and the link token is the authority (one use, seven days).
 * GET ?token=… → { email, companyName } or 404. POST { token, password } → { ok, email } or 400.
 */
export async function GET(request: Request) {
  const out = await systemPeekTeamToken(new URL(request.url).searchParams.get('token') ?? '');
  if (!out) return NextResponse.json({ error: 'This link is invalid or has expired' }, { status: 404 });
  return NextResponse.json(out);
}

const bodySchema = z.object({ token: z.string().min(32).max(128), password: z.string().min(8, 'Use at least 8 characters').max(128) });

export async function POST(request: Request) {
  const body = await parseJsonBody(request, bodySchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const out = await systemSetTeamPassword(body.data.token, body.data.password);
  if (out.status === 'ok') return NextResponse.json({ ok: true, email: out.email });
  return NextResponse.json({ error: out.status === 'too_short' ? 'Use at least 8 characters' : 'This link is invalid or has expired' }, { status: 400 });
}
