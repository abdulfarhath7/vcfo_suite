import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances, complianceObligations } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess, listScopedEngagementIds } from '@/db/repositories/engagements';
import { isFirmWideAdmin } from '@/lib/auth';
import { obligationText } from '@/data/obligation-texts';
import { dueRuleSentence } from '@/lib/obligations/due-rule-text';
import type { ObligationAbout } from '@/lib/obligations/about';

export type { ObligationAbout };

/**
 * OBLIGATION ABOUT — the "About", "Why it applies" and "If filed late" facts of one
 * statutory obligation for the obligation records (G-04).
 *
 * `compliance_obligations` is a library every role may read (the RLS port), but a record
 * only asks for an obligation the caller has on their register, so the read is scoped
 * like the register itself:
 *   super_admin / admin — any obligation;
 *   manager / intern / client — only an obligation with at least one instance on an
 *     engagement in `listScopedEngagementIds(ctx)`;
 *   by instance id — only when `assertEngagementAccess` allows the instance's engagement
 *     (the client portal groups filings by name, so it asks with a filing id).
 * Any other role (developer) gets null before the first query.
 */

const STAFF_AND_CLIENT = new Set(['super_admin', 'admin', 'manager', 'intern', 'client']);

export async function getObligationAbout(
  ctx: AuthContext,
  input: { obligationId?: string | null; instanceId?: string | null },
): Promise<ObligationAbout | null> {
  if (!STAFF_AND_CLIENT.has(ctx.role)) return null;
  let obligationId = input.obligationId?.trim() || null;
  const instanceId = input.instanceId?.trim() || null;

  if (instanceId) {
    const [inst] = await db
      .select({ engagementId: complianceInstances.engagementId, obligationId: complianceInstances.obligationId })
      .from(complianceInstances)
      .where(eq(complianceInstances.id, instanceId))
      .limit(1);
    if (!inst) return null;
    const access = await assertEngagementAccess(ctx, inst.engagementId);
    if (!access.ok) return null;
    if (obligationId && obligationId !== inst.obligationId) return null;
    obligationId = inst.obligationId;
  } else if (!obligationId) {
    return null;
  } else if (!isFirmWideAdmin(ctx.role)) {
    const scope = await listScopedEngagementIds(ctx);
    if (scope.length === 0) return null;
    const [held] = await db
      .select({ id: complianceInstances.id })
      .from(complianceInstances)
      .where(and(eq(complianceInstances.obligationId, obligationId), inArray(complianceInstances.engagementId, scope)))
      .limit(1);
    if (!held) return null;
  }

  const [row] = await db
    .select({
      id: complianceObligations.id,
      particular: complianceObligations.particular,
      complianceArea: complianceObligations.complianceArea,
      authority: complianceObligations.authority,
      frequency: complianceObligations.frequency,
      triggerType: complianceObligations.triggerType,
      dueRule: complianceObligations.dueRule,
      applicabilityNote: complianceObligations.applicabilityNote,
      isConditional: complianceObligations.isConditional,
      penaltyRisk: complianceObligations.penaltyRisk,
    })
    .from(complianceObligations)
    .where(eq(complianceObligations.id, obligationId!))
    .limit(1);
  if (!row) return null;

  const text = obligationText(row.id);
  return {
    id: row.id,
    name: row.particular,
    area: row.complianceArea,
    authority: row.authority,
    frequency: row.frequency,
    penaltyRisk: row.penaltyRisk,
    isConditional: Boolean(row.isConditional),
    applicabilityNote: row.applicabilityNote?.trim() || null,
    dueRule: dueRuleSentence(row.dueRule, { fyEnd: row.triggerType === 'fy_end' }),
    about: text?.about ?? null,
    whyItApplies: text?.whyItApplies ?? null,
    ifLate: text?.ifLate ?? null,
  };
}
