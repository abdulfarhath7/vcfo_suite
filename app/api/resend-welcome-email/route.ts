import { NextResponse } from 'next/server';
import { parseJsonBody } from '@/lib/api/parse-body';
import { requireAdminOrManager } from '@/lib/api/require-manager';
import { resendWelcomeEmailBodySchema } from '@/lib/api/schemas';
import { checkWelcomeEmailRateLimit } from '@/lib/api/rate-limit';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import {
  getClientProfileForEngagement,
  getEngagementById,
} from '@/db/repositories/engagements';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
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

  const body = await parseJsonBody(request, resendWelcomeEmailBodySchema);
  if (body.ok === false) {
    return NextResponse.json({ ok: false, error: body.error }, { status: body.status });
  }

  const dbId = engagementDbId(body.data.engagementId);
  // Repository scope enforces admin (all) / manager (owned) access.
  const engagement = await getEngagementById(auth.ctx, dbId);

  if (!engagement) {
    return NextResponse.json({ ok: false, error: 'engagement_not_found' }, { status: 404 });
  }

  if (!engagement.clientUserId) {
    return NextResponse.json({ ok: false, error: 'no_client_user' }, { status: 400 });
  }

  const clientProfile = await getClientProfileForEngagement(auth.ctx, engagement.clientUserId);
  if (!clientProfile?.email) {
    return NextResponse.json({ ok: false, error: 'client_email_not_found' }, { status: 400 });
  }

  const clientName =
    engagement.clientName?.trim() ||
    clientProfile.name?.trim() ||
    engagement.companyName;
  const createdAt = engagement.createdAt.toISOString();

  const engagementProgressCc = await fetchEngagementProgressCcEmails(auth.ctx, dbId);

  const result = await sendWelcomeEmail({
    clientEmail: clientProfile.email.trim().toLowerCase(),
    clientName,
    companyName: engagement.companyName,
    stage: engagement.stage,
    health: engagement.health,
    createdAt,
    isResend: true,
    engagementProgressCc,
    managerName: auth.ctx.name,
    managerEmail: auth.ctx.email,
    portalUrl: resolvePortalUrl(),
  });

  if (result.ok || result.skipped) {
    await recordAuditEvent(auth.ctx, {
      engagementId: body.data.engagementId,
      action: 'welcome_email.resend',
      summary: `Resent welcome email for ${engagement.companyName}`,
      metadata: {
        clientEmail: clientProfile.email.trim().toLowerCase(),
        skipped: result.skipped ?? false,
      },
      actorEmail: auth.ctx.email,
      actorName: auth.ctx.name,
    });
  }

  return NextResponse.json(result, { status: result.ok || result.skipped ? 200 : 502 });
}
