import 'server-only';

import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { canSetScheduleWindows } from '@/lib/schedule-windows';
import { todayIso } from '@/lib/client-portal/compliances';

/**
 * FILED DATE — "Mark filed" on the staff filings register (manager portal
 * redesign, prototype a59s `mxRenderers.filings`).
 *
 * >>> ACCESS CONTROL (Path A, same rule as the filing windows) <<<
 *   write — manager on an owned / co-managed engagement, admin, super_admin
 *           (`canSetScheduleWindows`). A lead or client write throws here,
 *           whatever the UI showed. The instance must sit on an engagement
 *           the caller may read (`assertEngagementAccess`); anything else
 *           reads as "not found" (no cross-tenant probing).
 *
 * Writes `filed_on` and keeps `status` in step ('filed', or back to
 * 'overdue' / 'upcoming' from the due date when cleared): the WhatsApp nudge
 * scan reads `status`, everything else reads `filed_on`. The Inngest
 * regeneration upsert never touches either column.
 */
export class FilingFiledError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404,
  ) {
    super(message);
  }
}

export async function setComplianceInstanceFiled(
  ctx: AuthContext,
  instanceId: string,
  filedOn: string | null,
): Promise<{ id: string; filedOn: string | null; status: string }> {
  if (!canSetScheduleWindows(ctx.role)) {
    throw new FilingFiledError('Only a project manager or admin may mark a filing filed', 403);
  }
  if (!/^[0-9a-f-]{36}$/i.test(instanceId)) throw new FilingFiledError('Filing not found', 404);
  const today = todayIso();
  if (filedOn !== null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filedOn) || Number.isNaN(Date.parse(`${filedOn}T00:00:00Z`))) {
      throw new FilingFiledError('invalid_date', 400);
    }
    if (filedOn > today) throw new FilingFiledError('A filing cannot be filed in the future', 400);
  }

  const [row] = await db
    .select({
      id: complianceInstances.id,
      engagementId: complianceInstances.engagementId,
      dueDate: complianceInstances.dueDate,
      filedOn: complianceInstances.filedOn,
    })
    .from(complianceInstances)
    .where(eq(complianceInstances.id, instanceId))
    .limit(1);
  if (!row) throw new FilingFiledError('Filing not found', 404);
  const access = await assertEngagementAccess(ctx, row.engagementId);
  if (!access.ok) throw new FilingFiledError('Filing not found', 404);

  const status = filedOn ? 'filed' : row.dueDate < today ? 'overdue' : 'upcoming';
  const [updated] = await db
    .update(complianceInstances)
    .set({ filedOn, status })
    .where(eq(complianceInstances.id, row.id))
    .returning({ id: complianceInstances.id, filedOn: complianceInstances.filedOn, status: complianceInstances.status });

  void recordAuditEvent(ctx, {
    engagementId: row.engagementId,
    action: filedOn ? 'compliance.filed' : 'compliance.filed.cleared',
    summary: filedOn ? `Filing marked filed on ${filedOn}` : 'Filed date cleared',
    metadata: { instanceId: row.id, filedOn, previous: row.filedOn ?? null },
  });
  return { id: updated?.id ?? row.id, filedOn: updated?.filedOn ?? null, status: updated?.status ?? status };
}
