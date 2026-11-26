import 'server-only';

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceSubjectFields } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess, checklistStateFromRow, type EngagementDbRow } from '@/db/repositories/engagements';
import { getItem } from '@/data/checklist';
import { extractItemResponses } from '@/lib/checklist/checklist-responses';
import { GST_FIELD, GST_STEP_ID } from '@/lib/registrations/gst-tracker';
import { GSTIN_RE } from '@/lib/gstzen/types';

/**
 * Shared access rule for the GSTZen repositories (`gstn-sessions`, `gst-returns`, `agent-otp`,
 * `gst-notices`): the engagement scope from `assertEngagementAccess`, which already gives the
 * admins every engagement, a manager the engagements they own or co-manage, a project lead the
 * engagements they are on, and a client their own. Staff-only reads refuse a client (and the
 * developer and partner roles) before the first query.
 */

export const GST_AGENT_STAFF: ReadonlySet<string> = new Set(['super_admin', 'admin', 'manager', 'intern']);

export class GstAgentError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 410 | 422 | 503,
  ) {
    super(message);
    this.name = 'GstAgentError';
  }
}

export function isGstAgentStaff(ctx: AuthContext): boolean {
  return GST_AGENT_STAFF.has(ctx.role);
}

/** The engagement for a staff member, or a 403 / 404. */
export async function staffEngagement(ctx: AuthContext, engagementId: string): Promise<{ dbId: string; row: EngagementDbRow }> {
  if (!isGstAgentStaff(ctx)) throw new GstAgentError('Only firm staff can use the GST return agents.', 403);
  return anyEngagement(ctx, engagementId);
}

/** The engagement for anyone in its scope (staff or the client), or a 403 / 404. */
export async function anyEngagement(ctx: AuthContext, engagementId: string): Promise<{ dbId: string; row: EngagementDbRow }> {
  if (ctx.role === 'developer' || ctx.role === 'partner') throw new GstAgentError('Not permitted.', 403);
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) throw 'notFound' in access ? new GstAgentError('Engagement not found.', 404) : new GstAgentError('Not permitted on this engagement.', 403);
  return { dbId: access.dbId, row: access.row };
}

/**
 * The GSTIN recorded for an engagement: the GST registration tracker's GSTIN (reg-4 SBC field
 * `number`), else the checklist answer `gstinNumber` the tracker mirrors. Null when none is valid.
 */
export async function engagementGstin(dbId: string, row: EngagementDbRow): Promise<string | null> {
  const [field] = await db
    .select({ value: complianceSubjectFields.value })
    .from(complianceSubjectFields)
    .where(
      and(
        eq(complianceSubjectFields.engagementId, dbId),
        eq(complianceSubjectFields.subjectKind, 'registration'),
        eq(complianceSubjectFields.subjectKey, GST_STEP_ID),
        eq(complianceSubjectFields.side, 'sbc'),
        eq(complianceSubjectFields.fieldKey, GST_FIELD.gstin),
      ),
    )
    .limit(1);
  const fromTracker = field?.value?.trim().toUpperCase();
  if (fromTracker && GSTIN_RE.test(fromTracker)) return fromTracker;
  const item = getItem(GST_STEP_ID);
  if (!item) return null;
  const state = checklistStateFromRow(row) as Record<string, unknown>;
  const fromChecklist = extractItemResponses(item, (state[GST_STEP_ID] ?? null) as never).gstinNumber?.trim().toUpperCase();
  return fromChecklist && GSTIN_RE.test(fromChecklist) ? fromChecklist : null;
}
