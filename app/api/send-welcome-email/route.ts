import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requireAdminOrManager } from '@/lib/api/require-manager';
import { welcomeEmailBodySchema } from '@/lib/api/schemas';
import { checkWelcomeEmailRateLimit } from '@/lib/api/rate-limit';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { fetchEngagementProgressCcEmails } from '@/lib/email/fetch-engagement-progress-cc';
import { resolvePortalUrl, sendWelcomeEmail } from '@/lib/email/welcome-email';

export async function POST(request: Request) {
  const auth = await requireAdminOrManager();
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!checkWelcomeEmailRateLimit(auth.ctx.userId)) {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  }

  const body = await parseJsonBody(request, welcomeEmailBodySchema);
  if (body.ok === false) {
    return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  }

  const {
    clientEmail,
    clientName,
    companyName,
    stage,
    health,
    createdAt,
    clientPassword,
    engagementId,
  } = body.data;

  let engagementProgressCc: string[] | undefined;
  if (engagementId) {
    engagementProgressCc = await fetchEngagementProgressCcEmails(auth.ctx, engagementId);
  }

  const result = await sendWelcomeEmail({
    clientEmail,
    clientName,
    companyName,
    stage,
    health,
    createdAt,
    clientPassword,
    engagementProgressCc,
    managerName: auth.ctx.name,
    managerEmail: auth.ctx.email,
    portalUrl: resolvePortalUrl(),
  });

  if (result.ok || result.skipped) {
    await recordAuditEvent(auth.ctx, {
      engagementId: engagementId ?? undefined,
      action: 'welcome_email.send',
      summary: `Sent welcome email to ${clientEmail}`,
      metadata: { companyName, skipped: result.skipped ?? false },
      actorEmail: auth.ctx.email,
      actorName: auth.ctx.name,
    });
  }

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
