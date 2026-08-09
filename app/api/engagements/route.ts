import { NextResponse } from 'next/server';
import { requireAuth, requireAdminOrManager } from '@/auth/guards';
import {
  createProjectWithClient,
  listEngagements,
  toAppEngagement,
  toAppEngagementsWithLeads,
} from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { parseJsonBody } from '@/lib/api/parse-body';
import { createProjectBodySchema } from '@/lib/api/schemas';
import { fetchEngagementProgressCcEmails } from '@/lib/email/fetch-engagement-progress-cc';
import { resolvePortalUrl, sendWelcomeEmail } from '@/lib/email/welcome-email';

/**
 * GET /api/engagements — role-scoped list.
 * POST /api/engagements — admin/manager creates client + engagement + welcome email.
 */
export async function GET() {
  const guard = await requireAuth();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const rows = await listEngagements(guard.ctx);
  return NextResponse.json({ engagements: await toAppEngagementsWithLeads(rows) });
}

export async function POST(request: Request) {
  const auth = await requireAdminOrManager();
  if (auth.ok === false) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await parseJsonBody(request, createProjectBodySchema);
  if (body.ok === false) {
    return NextResponse.json({ error: body.error }, { status: body.status });
  }

  const data = body.data;

  let created: Awaited<ReturnType<typeof createProjectWithClient>>;
  try {
    created = await createProjectWithClient(auth.ctx, data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'create_failed';
    if (message === 'email_already_registered') {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes('internId')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const engagementProgressCc = await fetchEngagementProgressCcEmails(
    auth.ctx,
    created.engagement.id,
  ).catch(() => [] as string[]);

  const emailResult = await sendWelcomeEmail({
    clientEmail: data.clientEmail.trim().toLowerCase(),
    clientName: data.clientName?.trim() || data.companyName.trim(),
    companyName: data.companyName.trim(),
    stage: created.engagement.stage,
    health: created.engagement.health,
    createdAt: created.engagement.createdAt,
    clientPassword: data.clientPassword,
    engagementProgressCc,
    managerName: auth.ctx.name,
    managerEmail: auth.ctx.email,
    portalUrl: resolvePortalUrl(),
  });

  await recordAuditEvent(auth.ctx, {
    engagementId: created.engagement.id,
    action: 'engagement.create',
    summary: `Created project ${created.engagement.companyName}`,
    metadata: {
      clientId: created.clientId,
      clientUserId: created.clientUserId,
      welcomeEmailSent: emailResult.ok,
      welcomeEmailSkipped: emailResult.skipped ?? false,
    },
    actorEmail: auth.ctx.email,
    actorName: auth.ctx.name,
  });

  return NextResponse.json(
    {
      engagement: created.engagement,
      clientId: created.clientId,
      clientUserId: created.clientUserId,
      emailSent: emailResult.ok,
      emailSkipped: emailResult.skipped ?? false,
      emailError: emailResult.ok ? undefined : emailResult.error,
    },
    { status: 201 },
  );
}
