import 'server-only';

import { and, asc, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances, complianceObligations } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import {
  assertEngagementAccess,
  checklistStateFromRow,
  getMyEngagement,
  type EngagementDbRow,
} from '@/db/repositories/engagements';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { listAuditEvents } from '@/db/repositories/audit-events';
import { appEngagementId } from '@/lib/legacy-engagement-ids';
import {
  buildBallInCourt,
  buildDeliverables,
  buildDocumentCounts,
  buildMilestones,
  buildNextAction,
  buildProgress,
  complianceGroupForAuthority,
  identifiersFromState,
  type ClientLegalForm,
  type ClientOverview,
  type ClientOverviewActivity,
  type ClientOverviewComplianceItem,
  type ClientOverviewState,
  type ClientOverviewTeamMember,
} from '@/lib/client-overview';

/**
 * CLIENT OVERVIEW REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * This is a read-only aggregate over rows other repositories already scope:
 *
 *   engagements            — `assertEngagementAccess` (admin all / manager owned /
 *                            lead assigned-or-member / client owner-or-member)
 *   compliance_instances   — restricted here to the SAME engagement id that
 *                            `assertEngagementAccess` just approved
 *   audit_events           — `listAuditEvents(ctx, { engagementId })`, which
 *                            re-checks the caller's scoped engagement ids
 *   profiles (team)        — only after engagement access is granted, and only
 *                            name + role are returned to the client
 *
 * There is no unscoped branch: with no `engagementId` the caller gets their own
 * first scoped engagement via `getMyEngagement(ctx)`, never someone else's.
 *
 * Nothing here writes. Every actionable element in the UI deep-links into the
 * screen that owns the action.
 */

/** Recent scoped audit actions worth showing a non-accountant. */
const ACTIVITY_LIMIT = 12;

/** Compliance runway window (§8: "next ~90 days of filings"). */
export const COMPLIANCE_RUNWAY_DAYS = 90;

function legalFormOf(row: EngagementDbRow): ClientLegalForm {
  const value = row.entityLegalForm?.trim().toLowerCase();
  if (value === 'llp' || value === 'partnership' || value === 'proprietorship') return value;
  return 'company';
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Audit summaries are already written for humans; drop the noisy internals. */
const HIDDEN_AUDIT_ACTIONS = new Set([
  'board_resolution.draft',
  'board_resolution.update',
  'engagement.checklist.save_draft',
]);

function toActivity(rows: Awaited<ReturnType<typeof listAuditEvents>>): ClientOverviewActivity[] {
  return rows
    .filter((row) => !HIDDEN_AUDIT_ACTIONS.has(row.action))
    .slice(0, ACTIVITY_LIMIT)
    .map((row) => ({
      id: row.id,
      at: row.created_at,
      label: row.summary,
    }));
}

async function loadTeam(dbEngagementId: string): Promise<ClientOverviewTeamMember[]> {
  const recipients = await resolveEngagementRecipients(dbEngagementId);
  if (!recipients) return [];

  const seen = new Set<string>();
  const out: ClientOverviewTeamMember[] = [];

  for (const manager of recipients.managers) {
    if (seen.has(manager.userId)) continue;
    seen.add(manager.userId);
    out.push({
      id: manager.userId,
      name: manager.name,
      email: manager.email,
      role: 'Project Manager',
    });
  }
  for (const lead of recipients.leads) {
    if (seen.has(lead.userId)) continue;
    seen.add(lead.userId);
    // Never surface the code role word "intern" to a client.
    out.push({ id: lead.userId, name: lead.name, email: lead.email, role: 'Project Lead' });
  }
  return out;
}

/**
 * Upcoming filings for one already-authorized engagement.
 * Scoped by the caller-approved `dbEngagementId`, so a client can only ever
 * read their own runway.
 */
async function loadComplianceRunway(
  dbEngagementId: string,
  now: Date,
): Promise<ClientOverviewComplianceItem[]> {
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + COMPLIANCE_RUNWAY_DAYS);

  const rows = await db
    .select({
      id: complianceInstances.id,
      obligationId: complianceInstances.obligationId,
      dueDate: complianceInstances.dueDate,
      status: complianceInstances.status,
      periodLabel: complianceInstances.periodLabel,
    })
    .from(complianceInstances)
    .where(
      and(
        inArray(complianceInstances.engagementId, [dbEngagementId]),
        gte(complianceInstances.dueDate, ymd(now)),
        lte(complianceInstances.dueDate, ymd(horizon)),
      ),
    )
    .orderBy(asc(complianceInstances.dueDate));

  if (rows.length === 0) return [];

  const obligationIds = [...new Set(rows.map((row) => row.obligationId))];
  const obligations = await db
    .select({
      id: complianceObligations.id,
      particular: complianceObligations.particular,
      authority: complianceObligations.authority,
    })
    .from(complianceObligations)
    .where(inArray(complianceObligations.id, obligationIds));

  const byId = new Map(obligations.map((row) => [row.id, row]));

  return rows.map((row) => {
    const obligation = byId.get(row.obligationId);
    const authority = obligation?.authority?.trim() || 'Other';
    return {
      id: row.id,
      title: obligation?.particular?.trim() || row.obligationId,
      authority,
      group: complianceGroupForAuthority(authority),
      dueDate: row.dueDate,
      status: row.status,
      periodLabel: row.periodLabel?.trim() || undefined,
    };
  });
}

/**
 * The single scoped read behind the client mission-control surface.
 * Returns `null` when the caller has no engagement, or is not permitted to see
 * the one they asked for — the route turns that into 404, never a leak.
 */
export async function getClientOverview(
  ctx: AuthContext,
  engagementId?: string,
  now: Date = new Date(),
): Promise<ClientOverview | null> {
  let row: EngagementDbRow;
  let dbId: string;

  if (engagementId?.trim()) {
    const access = await assertEngagementAccess(ctx, engagementId.trim());
    if (!access.ok) return null;
    row = access.row;
    dbId = access.dbId;
  } else {
    const mine = await getMyEngagement(ctx);
    if (!mine) return null;
    // getMyEngagement returns the list row (no jsonb); re-read through the
    // access check so the state blob comes back under the same guard.
    const access = await assertEngagementAccess(ctx, mine.id);
    if (!access.ok) return null;
    row = access.row;
    dbId = access.dbId;
  }

  const state: ClientOverviewState = checklistStateFromRow(row);
  const identifiers = identifiersFromState(state);
  const progress = buildProgress(state);
  const deliverables = buildDeliverables(state);

  const [team, upcoming, auditRows] = await Promise.all([
    loadTeam(dbId),
    loadComplianceRunway(dbId, now),
    listAuditEvents(ctx, { engagementId: dbId, limit: 40 }),
  ]);

  const incorporationDate = row.incorporationDate?.trim() || undefined;

  return {
    engagement: {
      id: appEngagementId(row.id),
      slug: row.slug ?? null,
      companyName: row.companyName,
      legalForm: legalFormOf(row),
      domesticOrForeign: row.companyType === 'foreign' ? 'foreign' : 'domestic',
      stage: row.stage,
      startDate: row.createdAt.toISOString(),
      incorporationDate,
      registeredOffice: row.subsidiaryRegisteredAddress?.trim() || undefined,
      parentEntityName: row.parentEntityName?.trim() || undefined,
    },
    identifiers,
    incorporated: Boolean(identifiers.cin || incorporationDate),
    progress,
    nextAction: buildNextAction(state),
    ballInCourt: buildBallInCourt(state),
    documents: {
      deliverables,
      counts: buildDocumentCounts(state, deliverables.length),
    },
    compliance: { upcoming },
    milestones: buildMilestones(state),
    activity: toActivity(auditRows),
    team,
  };
}
