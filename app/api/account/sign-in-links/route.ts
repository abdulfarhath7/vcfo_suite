import { NextResponse } from 'next/server';
import { requireAnyRole } from '@/auth/guards';
import { MICROSOFT_PROVIDER_ID, microsoftSignInConfigured } from '@/auth/microsoft';
import { getOwnSignInLink, removeOwnSignInLink } from '@/db/repositories/sign-in-links';

/**
 * GET /api/account/sign-in-links — the "Microsoft sign-in" row on Profile › Sign-in and security
 * (S-650): whether the firm set Microsoft sign-in up, and the caller's own link.
 * DELETE — remove the caller's own link. Staff only; a client and the developer never link.
 */
export async function GET() {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const configured = microsoftSignInConfigured();
  const link = await getOwnSignInLink(auth.ctx, MICROSOFT_PROVIDER_ID);
  return NextResponse.json({ ok: true, microsoft: { configured, provider: MICROSOFT_PROVIDER_ID, link } });
}

export async function DELETE() {
  const auth = await requireAnyRole('admin', 'manager', 'intern');
  if (auth.ok === false) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  const removed = await removeOwnSignInLink(auth.ctx, MICROSOFT_PROVIDER_ID);
  return NextResponse.json({ ok: true, removed });
}
