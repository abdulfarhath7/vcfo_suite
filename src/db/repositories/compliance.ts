import 'server-only';

import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  complianceInstances,
  complianceObligations,
  engagementComplianceTriggers,
  engagements,
  profiles,
} from '@/db/schema';
import { generateComplianceInstances } from '@/lib/compliance/generate-instances';
import { COMPLIANCE_OBLIGATIONS } from '@/lib/compliance/obligations-seed';
import { OBLIGATION_ACTIVITY } from '@/data/compliance-activities';
import type {
  ComplianceInstance,
  EngagementComplianceTriggers,
  EntityLegalForm,
} from '@/lib/compliance/types';

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
 * `systemGenerateComplianceInstances` is the Inngest
 * cron entry point. It is intentionally unscoped (no AuthContext) and is the
 * ONLY system-job writer for this table — document any new callers as system jobs.
 */

type EngagementComplianceTriggersRow =
  typeof engagementComplianceTriggers.$inferSelect;

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

interface UpsertComplianceInstanceInput {
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
        // The activity master link (0030); existing rows get it from systemEnsureActivitiesSeeded.
        activityId: OBLIGATION_ACTIVITY[o.id] ?? null,
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

/**
 * SYSTEM (Inngest only — no AuthContext): the compliance instances that may get a WhatsApp
 * nudge today. Only what a template variable needs — obligation name, company name, due
 * date — plus the frequency and the days left, so the job can apply each recipient's own
 * reminder days (`dueNudgeToday`, notification_prefs.remind_days).
 *
 * Rows:
 *   overdue — due yesterday (IST), any frequency, sent to clients and leads;
 *   due     — due in 1 to 7 IST days. With no personal choice a monthly filing nudges 5 days
 *             before and a quarterly one 7 days before, as before; a client who chose 7, 3 or
 *             1 days is nudged that many days before instead.
 * Filed instances and soft-deleted projects are excluded.
 */
export async function systemListComplianceNudges(today: Date): Promise<ComplianceNudgeRow[]> {
  const { ymdInIst, parseIstNoon } = await import('@/lib/intern/intern-work');

  const shift = (days: number): string => {
    const base = parseIstNoon(ymdInIst(today));
    base.setDate(base.getDate() + days);
    return ymdInIst(base);
  };

  const dueYesterday = shift(-1);
  const ahead = [1, 2, 3, 4, 5, 6, 7].map((d) => [shift(d), d] as const);
  const daysTo = new Map<string, number>(ahead);

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
      .where(inArray(complianceInstances.dueDate, [dueYesterday, ...ahead.map(([d]) => d)]));

    const out: ComplianceNudgeRow[] = [];
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
        frequency: row.frequency,
      };
      if (row.dueDate === dueYesterday) {
        out.push({ kind: 'compliance_overdue', daysToDue: -1, ...base });
        continue;
      }
      const days = daysTo.get(row.dueDate);
      if (days === undefined) continue;
      out.push({
        kind: row.frequency === 'monthly' ? 'compliance_due_monthly' : 'compliance_due_quarterly',
        daysToDue: days,
        ...base,
      });
    }
    return out;
  } catch (err) {
    console.error('[compliance] nudge scan failed', err);
    return [];
  }
}

export interface ComplianceNudgeRow {
  kind: 'compliance_due_monthly' | 'compliance_due_quarterly' | 'compliance_overdue';
  instanceId: string;
  engagementDbId: string;
  companyName: string;
  obligationName: string;
  dueDate: string;
  frequency: string;
  /** IST days from today to the due date; -1 for the overdue nudge. */
  daysToDue: number;
}
