import 'server-only';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/** The audit record of a manual send (GL-07): who, when (the row's time), to whom, and what. */
export async function recordEmailSent(
  ctx: Parameters<typeof recordAuditEvent>[0],
  input: { to: string[]; cc?: string[]; subject: string; engagementId?: string; itemId?: string; via: 'firm' | 'outlook' },
): Promise<void> {
  if (input.to.length === 0) return;
  await recordAuditEvent(ctx, {
    engagementId: input.engagementId ?? null,
    action: 'email.sent',
    summary: `${ctx.name || ctx.email} sent "${input.subject}" to ${input.to.join(', ')}`,
    metadata: { to: input.to, cc: input.cc ?? [], subject: input.subject, itemId: input.itemId ?? null, via: input.via },
  });
}
