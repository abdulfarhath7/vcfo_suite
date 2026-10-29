import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/auth/guards';
import { revealIdentifier } from '@/db/repositories/credentials';
import { parseJsonBody } from '@/lib/api/parse-body';
import { revealExpiresAt } from '@/lib/client-portal/identifiers';
import { credentialsError } from '../../credentials/_respond';

const body = z.object({ field: z.enum(['pan', 'tan']), password: z.string().min(1).max(128) });

/**
 * POST /api/client/identifiers/reveal — re-checks the signed-in client's own
 * password (bcrypt vs profiles.password_hash), 3 tries then a 60 s lock,
 * audits `identifiers.reveal` and returns the clear PAN / TAN once, with
 * `expiresAt` (G-07): the time the screen must hide it again, so the Company
 * IDs card shows a real countdown.
 */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) return NextResponse.json({ ok: false, error: guard.error }, { status: guard.status });
  const parsed = await parseJsonBody(request, body);
  if (parsed.ok === false) return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  try {
    const revealed = await revealIdentifier(guard.ctx, parsed.data);
    const out = revealed.ok === true ? { ...revealed, expiresAt: revealExpiresAt() } : revealed;
    const status = out.ok === true ? 200 : out.error === 'locked' ? 423 : out.error === 'not_recorded' ? 404 : 401;
    return NextResponse.json(out, { status, headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return credentialsError(e);
  }
}
