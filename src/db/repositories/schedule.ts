import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { assertEngagementAccess, getEngagementById } from '@/db/repositories/engagements';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import {
  applyScheduleWindow,
  canSetScheduleWindows,
  isValidWindowRange,
  normalizeEngagementSchedule,
  type EngagementSchedule,
  type ScheduleTarget,
} from '@/lib/schedule-windows';

/**
 * SCHEDULE REPOSITORY — manager-set date windows.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   read  — whoever can read the engagement (the windows ride on the
 *           engagement row / the filings register, both already scoped)
 *   write — manager on an owned engagement, admin, super_admin. A lead or
 *           client write throws here, whatever the UI showed.
 */

export type WindowInput = { from: string; to: string } | null;

function assertMayWrite(ctx: AuthContext): void {
  if (!canSetScheduleWindows(ctx.role)) {
    throw new Error('Only a project manager or admin may set date windows');
  }
}

function assertRange(window: WindowInput): void {
  if (window && !isValidWindowRange(window.from, window.to)) {
    throw new Error('invalid_window');
  }
}

/** Set (or clear, with `null`) the incorporation window or one step's window. */
export async function setEngagementWindow(
  ctx: AuthContext,
  appEngagementId: string,
  target: ScheduleTarget,
  window: WindowInput,
): Promise<EngagementSchedule> {
  assertMayWrite(ctx);
  assertRange(window);
  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  if (!existing) throw new Error('Engagement not found or not permitted');

  const now = new Date().toISOString();
  const next = applyScheduleWindow(normalizeEngagementSchedule(existing.schedule), target, window, {
    setBy: ctx.userId,
    now,
  });
  await db
    .update(engagements)
    .set({ schedule: next, updatedAt: new Date() })
    .where(eq(engagements.id, existing.id));

  void recordAuditEvent(ctx, {
    engagementId: existing.id,
    action: window ? 'schedule.window.set' : 'schedule.window.cleared',
    summary:
      target.kind === 'incorporation'
        ? window
          ? `Incorporation window set ${window.from} → ${window.to}`
          : 'Incorporation window cleared'
        : window
          ? `Window for ${target.itemId} set ${window.from} → ${window.to}`
          : `Window for ${target.itemId} cleared`,
    metadata: { target, window },
  });
  return next;
}

/** Set (or clear) the working window on one compliance instance. */
export async function setComplianceInstanceWindow(
  ctx: AuthContext,
  instanceId: string,
  window: WindowInput,
): Promise<{ id: string; windowFrom: string | null; windowTo: string | null }> {
  assertMayWrite(ctx);
  assertRange(window);
  const [row] = await db
    .select({ id: complianceInstances.id, engagementId: complianceInstances.engagementId })
    .from(complianceInstances)
    .where(eq(complianceInstances.id, instanceId))
    .limit(1);
  if (!row) throw new Error('Compliance instance not found');
  const access = await assertEngagementAccess(ctx, row.engagementId);
  if (!access.ok) throw new Error('Engagement not found or not permitted');

  const [updated] = await db
    .update(complianceInstances)
    .set({
      windowFrom: window?.from ?? null,
      windowTo: window?.to ?? null,
      windowSetBy: window ? ctx.userId : null,
      windowSetAt: window ? new Date() : null,
    })
    .where(eq(complianceInstances.id, instanceId))
    .returning({
      id: complianceInstances.id,
      windowFrom: complianceInstances.windowFrom,
      windowTo: complianceInstances.windowTo,
    });

  void recordAuditEvent(ctx, {
    engagementId: row.engagementId,
    action: window ? 'schedule.window.set' : 'schedule.window.cleared',
    summary: window
      ? `Compliance window set ${window.from} → ${window.to}`
      : 'Compliance window cleared',
    metadata: { instanceId, window },
  });
  return updated;
}
