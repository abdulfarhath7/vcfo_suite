import { NextResponse } from 'next/server';
import { requireAdmin } from '@/auth/guards';
import { createZohoState, zohoAuthorizeUrl, zohoConfigured } from '@/lib/integrations/zoho/oauth';

/**
 * GET /api/integrations/zoho/connect — start the firm's Zoho sign-in (docs/specs/integrations/ZOHO.md).
 * Super admin and admin only. The signed state rides in an httpOnly cookie for 15 minutes.
 */
export async function GET() {
  const guard = await requireAdmin();
  if (guard.ok === false) return NextResponse.json({ error: guard.error }, { status: guard.status });
  if (!zohoConfigured()) return NextResponse.json({ error: 'zoho_not_configured' }, { status: 503 });

  const state = createZohoState(guard.ctx.userId);
  const res = NextResponse.redirect(zohoAuthorizeUrl(state));
  res.cookies.set('vcfo_zoho_oauth', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 15 * 60,
  });
  return res;
}
