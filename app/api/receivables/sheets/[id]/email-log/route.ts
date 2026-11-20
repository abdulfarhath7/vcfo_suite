import { after, NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonBody } from '@/lib/api/parse-body';
import { approveEmailLogs, getSignName, lastAutoSends, listEmailLogPage, mayApprove, skipEmailLogs } from '@/db/repositories/receivables';
import { emails, fromEmailOf, notifyTeam } from '@/lib/receivables/team-notify';
import { assertOutlookReady } from '@/db/repositories/outlook-connections';
import { outlookErrorCode } from '@/lib/receivables/summary-send';
import { tidyEmailHtml } from '@/lib/receivables/recipients';
import { deliverLoggedEmail, prepareDueEmails } from '@/lib/receivables/v2-send';
import type { EmailKind, EmailStatus } from '@/lib/receivables/v2-wire';
import { denied, guardReceivables, receivablesError, type RouteContext } from '../../../_respond';

/**
 * /api/receivables/sheets/:id/email-log — the Email log tab (owner, 19–20 Nov 2026).
 * GET — every email of the sheet, automatic and manual, newest first, 50 a page. Query:
 *   origin=auto|manual, kind, status, q (subject, name or address), before (the last row's createdAt).
 *   The first page first prepares the roll-up and digest that are due: there is no clock, so they
 *   are made when someone opens Receivables, and they wait for approval.
 * POST { action: 'approve' | 'skip', ids, html? } — approve sends the waiting emails from the
 *   caller's Outlook (with the words they changed, by id), after the response; skip never sends them.
 */
export async function GET(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const p = new URL(request.url).searchParams;
  const origin = p.get('origin');
  try {
    if (!p.get('before')) {
      // The scoped read checks the caller may open this sheet before the system work runs.
      await lastAutoSends(guard.ctx, id);
      await prepareDueEmails(id);
    }
    return NextResponse.json(
      await listEmailLogPage(guard.ctx, id, {
        origin: origin === 'auto' || origin === 'manual' ? origin : undefined,
        kind: (p.get('kind') || undefined) as EmailKind | undefined,
        status: (p.get('status') || undefined) as EmailStatus | undefined,
        q: p.get('q') ?? undefined,
        before: p.get('before'),
      }),
    );
  } catch (e) {
    return receivablesError(e);
  }
}

const schema = z.object({
  action: z.enum(['approve', 'skip']),
  ids: z.array(z.string().uuid()).min(1).max(200),
  html: z.record(z.string().uuid(), z.string().min(1).max(300_000)).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const guard = await guardReceivables();
  if (guard.ok === false) return denied(guard);
  const { id } = await context.params;
  const body = await parseJsonBody(request, schema);
  if (body.ok === false) return NextResponse.json({ error: body.error }, { status: body.status });
  const input = body.data as z.infer<typeof schema>;
  try {
    // Team members whose "can approve" switch is off may look but not approve or skip.
    if (!(await mayApprove(guard.ctx, id))) return NextResponse.json({ error: 'not_approver' }, { status: 403 });
    const who = (await getSignName(guard.ctx).catch(() => null)) || 'Someone';
    const from = await fromEmailOf(guard.ctx);
    if (input.action === 'skip') {
      const skipped = await skipEmailLogs(guard.ctx, id, input.ids);
      if (skipped.length) after(() => notifyTeam(id, `${who} skipped ${emails(skipped.length)}; they will not be sent`, { from, to: skipped.flat() }).then(() => undefined));
      return NextResponse.json({ ok: true, count: skipped.length });
    }
    // The approver's own Outlook sends them, so it must be connected first.
    await assertOutlookReady(guard.ctx);
    const html = Object.fromEntries(Object.entries(input.html ?? {}).map(([k, v]) => [k, tidyEmailHtml(v)]));
    const taken = await approveEmailLogs(guard.ctx, id, input.ids, html);
    const ctx = guard.ctx;
    after(async () => {
      let sent = 0;
      for (const t of taken) if ((await deliverLoggedEmail(t.id, { ctx })) === 'sent') sent += 1;
      // One WhatsApp to the team for the whole approval, with what failed.
      const failed = taken.length - sent;
      await notifyTeam(id, `${who} approved ${emails(taken.length)}: ${sent} sent${failed ? `, ${failed} failed (see the Email log)` : ''}`, { from, to: taken.flatMap((t) => t.to) });
    });
    return NextResponse.json({ ok: true, count: taken.length }, { status: 202 });
  } catch (e) {
    const code = outlookErrorCode(e);
    if (code) return NextResponse.json({ error: code }, { status: 409 });
    return receivablesError(e);
  }
}
