import { NextResponse } from 'next/server';
import { requireAuth } from '@/auth/guards';
import {
  acceptInviteByToken,
  createInvite,
  listInvites,
} from '@/db/repositories/invites';

/** GET /api/invites */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const invites = await listInvites(guard.ctx);
    return NextResponse.json({ invites });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/invites — create invite, or { action: 'accept', token } to accept. */
export async function POST(request: Request) {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  let body: {
    action?: string;
    token?: string;
    engagementId?: string;
    email?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (body.action === 'accept') {
    if (!body.token?.trim()) {
      return NextResponse.json({ error: 'token_required' }, { status: 400 });
    }
    const invite = await acceptInviteByToken(guard.ctx, body.token.trim());
    if (!invite) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ invite });
  }

  if (!body.engagementId?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: 'engagementId_and_email_required' }, { status: 400 });
  }
  try {
    const invite = await createInvite(guard.ctx, {
      engagementId: body.engagementId,
      email: body.email,
      token: body.token,
    });
    return NextResponse.json({ invite }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    const status = message.includes('not permitted') || message.includes('may not') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
