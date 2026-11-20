import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { escapeHtml } from '@/lib/email/email-layout';
import { sendEmail } from '@/lib/email/send-email';
import { siteUrl } from '@/lib/site-url';
import { addTeamMember, listTeam, removeTeamMember, updateTeamMember } from '@/db/repositories/receivables';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * /api/receivables/sheets/:id/team — the People tab's Team section (owner, 20 Nov 2026).
 * GET — the manager and the members. POST — adds one and emails them: a set-password link for a
 * new login, or a note that they were added. PATCH { userId, … } — role, number, switches.
 * DELETE ?userId= — takes a member off the sheet.
 */
const fields = {
  name: z.string().max(120).optional(),
  role: z.string().max(60).optional(),
  phone: z.string().max(30).nullable().optional(),
  whatsappUpdates: z.boolean().optional(),
  canApprove: z.boolean().optional(),
};
const addSchema = z.object({ ...fields, email: z.string().max(200) });
const patchSchema = z.object({ ...fields, userId: z.string().uuid() });

export async function GET(_request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  try {
    return NextResponse.json({ team: await listTeam(guard.ctx, id) });
  } catch (e) {
    return receivablesError(e);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, addSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  try {
    const { member, invite } = await addTeamMember(guard.ctx, id, body.data);
    const site = siteUrl();
    const url = invite.token ? `${site}/receivables/team-password?token=${encodeURIComponent(invite.token)}` : `${site}/login`;
    const what = invite.token ? 'Choose your password to sign in' : 'Sign in with your usual login';
    const html = `<p>Hi ${escapeHtml(invite.name)},</p><p>You were added to the <b>${escapeHtml(invite.sheetName)}</b> receivables team. You will get its WhatsApp updates and can approve the emails waiting to go out.</p><p><a href="${url}">${what}</a></p><p>The link works for seven days.</p>`;
    let emailed = false;
    try {
      emailed = (await sendEmail({ to: invite.to, subject: `You were added to the ${invite.sheetName} receivables team`, html, text: `${what}: ${url}`, purpose: 'receivables.team_invite' })).ok;
    } catch (e) {
      console.error('[receivables] team invite email failed', e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ member, emailed });
  } catch (e) {
    return receivablesError(e);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, patchSchema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const { userId, ...patch } = body.data;
  try {
    return NextResponse.json({ member: await updateTeamMember(guard.ctx, id, userId, patch) });
  } catch (e) {
    return receivablesError(e);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const userId = new URL(request.url).searchParams.get('userId') ?? '';
  try {
    await removeTeamMember(guard.ctx, id, userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return receivablesError(e);
  }
}
