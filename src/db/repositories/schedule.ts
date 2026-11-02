import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances, engagements } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { recordFilingEvent, windowEventLabel } from '@/db/repositories/filing-events';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { assertEngagementAccess, getEngagementById } from '@/db/repositories/engagements';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import {
  applyScheduleWindow,
  canSetScheduleWindows,
  isValidWindowRange,
  normalizeEngagementSchedule,
  type EngagementSchedule,
  type ScheduleTarget,
} from '@/lib/projects/schedule-windows';

/**
 * SCHEDULE REPOSITORY — manager-set date windows.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   read  — whoever can read the engagement (the windows ride on the
 *           engagement row / the filings register, both already scoped)
 *   write — manager on an owned engagement, admin, super_admin. A lead or
 *           client write throws here, whatever the UI showed.
 *           Exception: setClientComplianceWindow() — a client may move the
 *           planning window of their OWN company's unfiled filings (never a
 *           due date, never another company's filing).
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
  void recordFilingEvent(ctx, {
    instanceId,
    side: 'sbc',
    label: windowEventLabel(window, 'sbc'),
  });
  return updated;
}

/**
 * A client moves / resizes the PLANNING window of one of their own company's
 * filings (compliances Timeline view, TL-13 owner decision). The statutory
 * due date is never touched. Rules, enforced here whatever the UI shows:
 *   - role client only (firm staff use setComplianceInstanceWindow);
 *   - the instance must belong to an engagement this client can read
 *     (assertEngagementAccess: own company or invited member) — a foreign
 *     instance reads as "not found" (no cross-tenant probing);
 *   - a filed instance is locked;
 *   - clearing is allowed only for a window this same client set (Undo of a
 *     first move); a manager's window can be moved, never deleted.
 */
export async function setClientComplianceWindow(
  ctx: AuthContext,
  instanceId: string,
  window: WindowInput,
): Promise<{ id: string; windowFrom: string | null; windowTo: string | null }> {
  if (ctx.role !== 'client') throw new Error('Only a client may use the client window route');
  assertRange(window);
  const [row] = await db
    .select({
      id: complianceInstances.id,
      engagementId: complianceInstances.engagementId,
      status: complianceInstances.status,
      filedOn: complianceInstances.filedOn,
      windowSetBy: complianceInstances.windowSetBy,
      windowFrom: complianceInstances.windowFrom,
    })
    .from(complianceInstances)
    .where(eq(complianceInstances.id, instanceId))
    .limit(1);
  if (!row) throw new Error('Compliance instance not found');
  const access = await assertEngagementAccess(ctx, row.engagementId);
  if (!access.ok) throw new Error('Compliance instance not found');
  if (row.filedOn || row.status === 'filed') throw new Error('filed_locked');
  if (!window && row.windowFrom && row.windowSetBy !== ctx.userId) throw new Error('clear_not_permitted');

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
    summary: window ? `Filing window moved ${window.from} → ${window.to}` : 'Filing window reset',
    metadata: { instanceId, window, by: 'client' },
  });
  void recordFilingEvent(ctx, { instanceId, side: 'client', label: windowEventLabel(window, 'client') });
  return updated!;
}

/**
 * Set (or clear, with `null`) the date the firm expects the certificate of incorporation
 * (`engagements.expected_coi_on`, G-13). Same writers as the windows: a manager on an owned
 * engagement, admin, super admin. Writes an audit event.
 */
export async function setExpectedCoi(
  ctx: AuthContext,
  appEngagementId: string,
  on: string | null,
): Promise<{ expectedCoiOn: string | null }> {
  assertMayWrite(ctx);
  if (on !== null && !isValidWindowRange(on, on)) throw new Error('invalid_date');
  const existing = await getEngagementById(ctx, engagementDbId(appEngagementId));
  if (!existing) throw new Error('Engagement not found or not permitted');

  await db
    .update(engagements)
    .set({ expectedCoiOn: on, updatedAt: new Date() })
    .where(eq(engagements.id, existing.id));

  void recordAuditEvent(ctx, {
    engagementId: existing.id,
    action: on ? 'schedule.expected_coi.set' : 'schedule.expected_coi.cleared',
    summary: on ? `Expected certificate date set to ${on}` : 'Expected certificate date cleared',
    metadata: { before: existing.expectedCoiOn ?? null, after: on },
  });
  return { expectedCoiOn: on };
}
