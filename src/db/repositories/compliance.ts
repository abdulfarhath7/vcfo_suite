import 'server-only';

import { eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  complianceInstances,
  complianceObligations,
  engagementComplianceTriggers,
  engagements,
  profiles,
} from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { generateComplianceInstances } from '@/lib/compliance/generate-instances';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';
import type {
  ComplianceInstance,
  EngagementComplianceTriggers,
  EntityLegalForm,
} from '@/lib/compliance/types';
import { engagementDbId } from '@/lib/legacy-engagement-ids';
import {
  assertEngagementAccess,
  getEngagementById,
  managerOwnsEngagement,
} from '@/db/repositories/engagements';
import { listLeadMemberEngagementIds } from '@/db/repositories/engagement-leads-membership';

/**
 * COMPLIANCE REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Reproduces 20260708120000_compliance_calendar.sql + v2/v3:
 *
 *   compliance_obligations — admin/manager/intern/client: read
 *   engagement_compliance_triggers / compliance_instances —
 *     admin: all
 *     manager: via owned engagements (manager_id / legacy admin_id)
 *     intern: write via assigned engagement; read same
 *     client: read-only via own engagement
 *
 * `systemGenerateComplianceInstances` / `runComplianceGenerate` is the Inngest
 * cron entry point. It is intentionally unscoped (no AuthContext) and is the
 * ONLY system-job writer for this table — document any new callers as system jobs.
 */

export type ComplianceObligationRow = typeof complianceObligations.$inferSelect;
export type EngagementComplianceTriggersRow =
  typeof engagementComplianceTriggers.$inferSelect;
export type ComplianceInstanceRow = typeof complianceInstances.$inferSelect;

function triggersFromRow(
  row: EngagementComplianceTriggersRow,
): EngagementComplianceTriggers {
  return {
    incorporationDate: row.incorporationDate,
    gstRegistrationDate: row.gstRegistrationDate,
    tanRegistrationDate: row.tanRegistrationDate,
    pfRegistrationDate: row.pfRegistrationDate,
    esiRegistrationDate: row.esiRegistrationDate,
    ptRegistrationDate: row.ptRegistrationDate,
    tdsLiabilityStartDate: row.tdsLiabilityStartDate,
    agmDate: row.agmDate,
  };
}

function clientEngagementScope(ctx: AuthContext) {
  if (ctx.clientId) {
    return or(
      eq(engagements.clientUserId, ctx.userId),
      eq(engagements.clientId, ctx.clientId),
    );
  }
  return eq(engagements.clientUserId, ctx.userId);
}

async function filterEngagementId(
  ctx: AuthContext,
  appOrDbId: string,
): Promise<string | null> {
  const access = await assertEngagementAccess(ctx, appOrDbId);
  if (!access.ok) return null;
  return access.dbId;
}

export async function listComplianceObligations(
  _ctx: AuthContext,
): Promise<ComplianceObligationRow[]> {
  // All authenticated roles may read the static library (RLS was SELECT for all).
  return db.select().from(complianceObligations);
}

export async function listEngagementComplianceTriggers(
  ctx: AuthContext,
  engagementId?: string,
): Promise<EngagementComplianceTriggersRow[]> {
  if (engagementId) {
    const dbId = await filterEngagementId(ctx, engagementId);
    if (!dbId) return [];
    return db
      .select()
      .from(engagementComplianceTriggers)
      .where(eq(engagementComplianceTriggers.engagementId, dbId));
  }

  if (ctx.role === 'admin') {
    return db.select().from(engagementComplianceTriggers);
  }

  if (ctx.role === 'manager') {
    const rows = await db
      .select({ trigger: engagementComplianceTriggers })
      .from(engagementComplianceTriggers)
      .innerJoin(
        engagements,
        eq(engagements.id, engagementComplianceTriggers.engagementId),
      )
      .where(managerOwnsEngagement(ctx.userId));
    return rows.map((r) => r.trigger);
  }

  if (ctx.role === 'intern') {
    if (!ctx.internId) return [];
    const memberIds = await listLeadMemberEngagementIds(ctx.internId);
    const scope =
      memberIds.length > 0
        ? or(eq(engagements.internId, ctx.internId), inArray(engagements.id, memberIds))
        : eq(engagements.internId, ctx.internId);
    const rows = await db
      .select({ trigger: engagementComplianceTriggers })
      .from(engagementComplianceTriggers)
      .innerJoin(
        engagements,
        eq(engagements.id, engagementComplianceTriggers.engagementId),
      )
      .where(scope);
    return rows.map((r) => r.trigger);
  }

  const rows = await db
    .select({ trigger: engagementComplianceTriggers })
    .from(engagementComplianceTriggers)
    .innerJoin(
      engagements,
      eq(engagements.id, engagementComplianceTriggers.engagementId),
    )
    .where(clientEngagementScope(ctx));
  return rows.map((r) => r.trigger);
}

export async function listComplianceInstances(
  ctx: AuthContext,
  engagementId?: string,
): Promise<ComplianceInstanceRow[]> {
  if (engagementId) {
    const dbId = await filterEngagementId(ctx, engagementId);
    if (!dbId) return [];
    return db
      .select()
      .from(complianceInstances)
      .where(eq(complianceInstances.engagementId, dbId));
  }

  if (ctx.role === 'admin') {
    return db.select().from(complianceInstances);
  }

  if (ctx.role === 'manager') {
    const rows = await db
      .select({ instance: complianceInstances })
      .from(complianceInstances)
      .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
      .where(managerOwnsEngagement(ctx.userId));
    return rows.map((r) => r.instance);
  }

  if (ctx.role === 'intern') {
    if (!ctx.internId) return [];
    const memberIds = await listLeadMemberEngagementIds(ctx.internId);
    const scope =
      memberIds.length > 0
        ? or(eq(engagements.internId, ctx.internId), inArray(engagements.id, memberIds))
        : eq(engagements.internId, ctx.internId);
    const rows = await db
      .select({ instance: complianceInstances })
      .from(complianceInstances)
      .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
      .where(scope);
    return rows.map((r) => r.instance);
  }

  const rows = await db
    .select({ instance: complianceInstances })
    .from(complianceInstances)
    .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
    .where(clientEngagementScope(ctx));
  return rows.map((r) => r.instance);
}

export interface UpsertComplianceInstanceInput {
  engagementId: string;
  obligationId: string;
  dueDate: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  periodLabel?: string | null;
  fyLabel?: string | null;
  status: string;
  ownerId?: string | null;
}

/**
 * Upsert generated instances. Managers and assigned interns may write;
 * clients may not. Dedupe key matches the SQL unique index.
 */
export async function upsertComplianceInstances(
  ctx: AuthContext,
  inputs: UpsertComplianceInstanceInput[],
): Promise<number> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not write compliance instances');
  }
  if (inputs.length === 0) return 0;

  const normalized = inputs.map((i) => ({
    ...i,
    engagementId: engagementDbId(i.engagementId),
  }));

  const seen = new Set<string>();
  for (const row of normalized) {
    if (seen.has(row.engagementId)) continue;
    seen.add(row.engagementId);
    const access = await assertEngagementAccess(ctx, row.engagementId);
    if (!access.ok) {
      throw new Error('Engagement not found or not permitted');
    }
  }

  return upsertComplianceInstanceRows(normalized);
}

async function upsertComplianceInstanceRows(
  inputs: UpsertComplianceInstanceInput[],
): Promise<number> {
  if (inputs.length === 0) return 0;

  let written = 0;
  const CHUNK = 100;
  for (let i = 0; i < inputs.length; i += CHUNK) {
    const chunk = inputs.slice(i, i + CHUNK);
    await db
      .insert(complianceInstances)
      .values(
        chunk.map((row) => ({
          engagementId: row.engagementId,
          obligationId: row.obligationId,
          dueDate: row.dueDate,
          periodStart: row.periodStart ?? null,
          periodEnd: row.periodEnd ?? null,
          periodLabel: row.periodLabel ?? '',
          fyLabel: row.fyLabel ?? null,
          status: row.status,
          ownerId: row.ownerId ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: [
          complianceInstances.engagementId,
          complianceInstances.obligationId,
          complianceInstances.dueDate,
          complianceInstances.periodLabel,
        ],
        set: {
          // Do not clobber filed/in-progress workflow state on regeneration.
          periodStart: sql`excluded.period_start`,
          periodEnd: sql`excluded.period_end`,
          fyLabel: sql`excluded.fy_label`,
          ownerId: sql`COALESCE(excluded.owner_id, ${complianceInstances.ownerId})`,
        },
      });
    written += chunk.length;
  }
  return written;
}

/** Ensure the static obligation library rows exist (FK for instances). */
async function ensureObligationsSeeded(): Promise<void> {
  if (COMPLIANCE_OBLIGATIONS.length === 0) return;
  await db
    .insert(complianceObligations)
    .values(
      COMPLIANCE_OBLIGATIONS.map((o) => ({
        id: o.id,
        complianceArea: o.complianceArea,
        particular: o.particular,
        authority: o.authority,
        frequency: o.frequency,
        triggerType: o.triggerType,
        dueRule: o.dueRule,
        appliesTo: o.appliesTo,
        applicabilityNote: o.applicabilityNote ?? null,
        isConditional: o.isConditional ?? false,
        penaltyRisk: o.penaltyRisk,
      })),
    )
    .onConflictDoNothing();
}

async function resolveOwnerUuid(
  internScopingId: string,
  adminId: string | null,
): Promise<string | null> {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.internId, internScopingId))
    .limit(1);
  return row?.id ?? adminId ?? null;
}

function instanceToUpsert(
  instance: ComplianceInstance,
  ownerUuid: string | null,
): UpsertComplianceInstanceInput {
  return {
    engagementId: instance.engagementId,
    obligationId: instance.obligationId,
    dueDate: instance.dueDate,
    periodStart: instance.periodStart ?? null,
    periodEnd: instance.periodEnd ?? null,
    periodLabel: instance.periodLabel ?? '',
    fyLabel: instance.fyLabel ?? null,
    status: instance.status,
    ownerId: ownerUuid,
  };
}

export interface SystemGenerateResult {
  engagements: number;
  generated: number;
  upserted: number;
  digest: Array<{
    engagementId: string;
    companyName: string;
    upcoming: number;
    overdue: number;
  }>;
}

/**
 * SYSTEM JOB — no AuthContext. Called only from Inngest `compliance-generate`
 * (and similar internal schedulers). Loads all triggers, expands via pure
 * `generateComplianceInstances`, upserts rows. DB access is intentional here.
 */
export async function systemGenerateComplianceInstances(
  asOfDate: Date = new Date(),
): Promise<SystemGenerateResult> {
  await ensureObligationsSeeded();

  const rows: Array<{
    trigger: EngagementComplianceTriggersRow;
    engagement: typeof engagements.$inferSelect;
  }> = (
    await db
      .select({
        trigger: engagementComplianceTriggers,
        engagement: engagements,
      })
      .from(engagementComplianceTriggers)
      .innerJoin(
        engagements,
        eq(engagements.id, engagementComplianceTriggers.engagementId),
      )
  ).map((r) => ({ trigger: r.trigger, engagement: r.engagement }));

  // Also cover engagements that only have incorporation_date on the row and
  // no triggers table entry yet.
  const withTriggers = new Set(rows.map((r) => r.engagement.id));
  const bare = await db.select().from(engagements);
  for (const eng of bare) {
    if (withTriggers.has(eng.id)) continue;
    if (!eng.incorporationDate) continue;
    rows.push({
      trigger: {
        engagementId: eng.id,
        incorporationDate: eng.incorporationDate,
        gstRegistrationDate: null,
        tanRegistrationDate: null,
        pfRegistrationDate: null,
        esiRegistrationDate: null,
        ptRegistrationDate: null,
        tdsLiabilityStartDate: null,
        agmDate: null,
        hasForeignInvestment: false,
        gstQrmp: false,
        sezUnit: false,
        updatedAt: new Date(),
      },
      engagement: eng,
    });
  }

  const digest: SystemGenerateResult['digest'] = [];
  const toUpsert: UpsertComplianceInstanceInput[] = [];

  for (const { trigger, engagement } of rows) {
    const ownerUuid = await resolveOwnerUuid(
      engagement.internId,
      engagement.adminId,
    );
    const triggers = triggersFromRow(trigger);
    if (!triggers.incorporationDate && engagement.incorporationDate) {
      triggers.incorporationDate = engagement.incorporationDate;
    }

    const instances = generateComplianceInstances({
      engagementId: engagement.id,
      entityLegalForm: (engagement.entityLegalForm ?? 'company') as EntityLegalForm,
      triggers,
      ownerId: ownerUuid ?? engagement.internId,
      asOfDate,
    });

    let upcoming = 0;
    let overdue = 0;
    for (const instance of instances) {
      if (instance.status === 'overdue') overdue += 1;
      else if (instance.status === 'upcoming') upcoming += 1;
      toUpsert.push(instanceToUpsert(instance, ownerUuid));
    }

    digest.push({
      engagementId: engagement.id,
      companyName: engagement.companyName,
      upcoming,
      overdue,
    });
  }

  const upserted = await upsertComplianceInstanceRows(toUpsert);

  return {
    engagements: rows.length,
    generated: toUpsert.length,
    upserted,
    digest,
  };
}

/** Convenience alias used by the Inngest job. */
export const runComplianceGenerate = systemGenerateComplianceInstances;

/** Manager/intern helper: regenerate one engagement after checklist updates. */
export async function regenerateComplianceForEngagement(
  ctx: AuthContext,
  appOrDbId: string,
  triggers: EngagementComplianceTriggers,
  asOfDate: Date = new Date(),
): Promise<number> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not regenerate compliance instances');
  }

  const engagement = await getEngagementById(ctx, engagementDbId(appOrDbId));
  if (!engagement) throw new Error('Engagement not found or not permitted');

  await ensureObligationsSeeded();

  await db
    .insert(engagementComplianceTriggers)
    .values({
      engagementId: engagement.id,
      incorporationDate: triggers.incorporationDate ?? null,
      gstRegistrationDate: triggers.gstRegistrationDate ?? null,
      tanRegistrationDate: triggers.tanRegistrationDate ?? null,
      pfRegistrationDate: triggers.pfRegistrationDate ?? null,
      esiRegistrationDate: triggers.esiRegistrationDate ?? null,
      ptRegistrationDate: triggers.ptRegistrationDate ?? null,
      tdsLiabilityStartDate: triggers.tdsLiabilityStartDate ?? null,
      agmDate: triggers.agmDate ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: engagementComplianceTriggers.engagementId,
      set: {
        incorporationDate: triggers.incorporationDate ?? null,
        gstRegistrationDate: triggers.gstRegistrationDate ?? null,
        tanRegistrationDate: triggers.tanRegistrationDate ?? null,
        pfRegistrationDate: triggers.pfRegistrationDate ?? null,
        esiRegistrationDate: triggers.esiRegistrationDate ?? null,
        ptRegistrationDate: triggers.ptRegistrationDate ?? null,
        tdsLiabilityStartDate: triggers.tdsLiabilityStartDate ?? null,
        agmDate: triggers.agmDate ?? null,
        updatedAt: new Date(),
      },
    });

  const ownerUuid = await resolveOwnerUuid(engagement.internId, engagement.adminId);
  const instances = generateComplianceInstances({
    engagementId: engagement.id,
    entityLegalForm: (engagement.entityLegalForm ?? 'company') as EntityLegalForm,
    triggers,
    ownerId: ownerUuid ?? engagement.internId,
    asOfDate,
  });

  return upsertComplianceInstances(
    ctx,
    instances.map((i) => instanceToUpsert(i, ownerUuid)),
  );
}

/**
 * SYSTEM READER — WhatsApp compliance nudges (Inngest cron).
 *
 * Unscoped like `systemGenerateComplianceInstances`: the daily job has no
 * session. Returns only what a template variable needs — obligation name,
 * company name, due date. No filing numbers, no evidence, no owner details.
 *
 * Windows are exact IST civil-day matches, so each instance enters a window
 * once:
 *   monthly   → 5 days before due
 *   quarterly → 7 days before due
 *   overdue   → the day after due, any frequency
 * Filed instances are excluded.
 */
export async function systemListComplianceNudges(today: Date): Promise<
  Array<{
    kind: 'compliance_due_monthly' | 'compliance_due_quarterly' | 'compliance_overdue';
    instanceId: string;
    engagementDbId: string;
    companyName: string;
    obligationName: string;
    dueDate: string;
  }>
> {
  const { ymdInIst, parseIstNoon } = await import('@/lib/intern-work');

  const shift = (days: number): string => {
    const base = parseIstNoon(ymdInIst(today));
    base.setDate(base.getDate() + days);
    return ymdInIst(base);
  };

  const dueInFive = shift(5);
  const dueInSeven = shift(7);
  const dueYesterday = shift(-1);

  try {
    const rows = await db
      .select({
        instanceId: complianceInstances.id,
        engagementDbId: complianceInstances.engagementId,
        dueDate: complianceInstances.dueDate,
        status: complianceInstances.status,
        companyName: engagements.companyName,
        deletedAt: engagements.deletedAt,
        obligationName: complianceObligations.particular,
        frequency: complianceObligations.frequency,
      })
      .from(complianceInstances)
      .innerJoin(engagements, eq(engagements.id, complianceInstances.engagementId))
      .innerJoin(
        complianceObligations,
        eq(complianceObligations.id, complianceInstances.obligationId),
      )
      .where(
        inArray(complianceInstances.dueDate, [dueInFive, dueInSeven, dueYesterday]),
      );

    const out: Array<{
      kind: 'compliance_due_monthly' | 'compliance_due_quarterly' | 'compliance_overdue';
      instanceId: string;
      engagementDbId: string;
      companyName: string;
      obligationName: string;
      dueDate: string;
    }> = [];

    for (const row of rows) {
      // Soft-deleted projects are hidden everywhere else — do not message them.
      if (row.deletedAt) continue;
      if (row.status === 'filed') continue;

      const base = {
        instanceId: row.instanceId,
        engagementDbId: row.engagementDbId,
        companyName: row.companyName,
        obligationName: row.obligationName,
        dueDate: row.dueDate,
      };

      if (row.dueDate === dueYesterday) {
        out.push({ kind: 'compliance_overdue', ...base });
        continue;
      }
      if (row.dueDate === dueInFive && row.frequency === 'monthly') {
        out.push({ kind: 'compliance_due_monthly', ...base });
        continue;
      }
      if (row.dueDate === dueInSeven && row.frequency === 'quarterly') {
        out.push({ kind: 'compliance_due_quarterly', ...base });
      }
    }

    return out;
  } catch (err) {
    console.error('[compliance] nudge scan failed', err);
    return [];
  }
}
