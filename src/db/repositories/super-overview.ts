import 'server-only';

import { and, asc, gte, inArray, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceInstances, complianceObligations } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import {
  assertEngagementAccess,
  checklistStateFromRow,
  listChecklistIndex,
  listEngagements,
  type EngagementListRow,
} from '@/db/repositories/engagements';
import { listDocuments } from '@/db/repositories/documents';
import { resolveEngagementRecipients } from '@/db/repositories/engagement-recipients';
import { listStaffPeople, type StaffPersonRow } from '@/db/repositories/profiles';
import { listAuditEvents } from '@/db/repositories/audit-events';
import { appEngagementId } from '@/lib/legacy-engagement-ids';
import {
  buildJourney,
  buildSuperOverview,
  summarizeEngagement,
  superEngagementHref,
  superFirmViewHref,
  SUPER_FILING_HORIZON_DAYS,
  type SuperActivityEntry,
  type SuperEngagementDetail,
  type SuperFiling,
  type SuperOverview,
  type SuperOverviewState,
  type SuperTeamMember,
} from '@/lib/super-overview';

/**
 * SUPER ADMIN OVERVIEW REPOSITORY.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 * Super admin's scope is "every engagement", but that scope is still granted by
 * the same predicates every other role goes through — there is no unscoped
 * branch written here:
 *
 *   engagements       — `listEngagements(ctx)` / `listChecklistIndex(ctx)`;
 *                       `scopeFor(ctx)` returns firm-wide only for
 *                       `isFirmWideAdmin(ctx.role)`, and a manager/lead/client
 *                       calling this gets their own narrow slice, not everyone's.
 *   audit_events      — `listAuditEvents(ctx)`, same predicate table.
 *   profiles          — `listStaffPeople(ctx)`, which itself throws unless the
 *                       caller is a firm-wide admin.
 *   compliance rows   — read here, restricted to the engagement ids the
 *                       engagement scope above already approved.
 *
 * On top of that, `assertSuperScope` refuses non-firm-wide callers outright, so
 * this aggregate is never the thing that widens someone's access.
 *
 * Nothing here writes. The whole surface is an observatory (context §3).
 */

/** Firm-wide activity shown on the Overview; the L2 activity screen paginates. */
const ACTIVITY_LIMIT = 24;

/** Audit rows that describe internal churn rather than firm progress. */
const HIDDEN_AUDIT_ACTIONS = new Set([
  'engagement.checklist.save_draft',
  'board_resolution.update',
]);

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assertSuperScope(ctx: AuthContext): void {
  if (!isFirmWideAdmin(ctx.role)) {
    throw new Error('Only firm-wide admins may read the super admin overview');
  }
}

/** internId → display name, and profile id → display name. */
function nameIndexes(staff: StaffPersonRow[]) {
  const byInternId = new Map<string, string>();
  const byProfileId = new Map<string, string>();
  for (const person of staff) {
    byProfileId.set(person.id, person.name);
    if (person.internId?.trim()) byInternId.set(person.internId.trim(), person.name);
  }
  return { byInternId, byProfileId };
}

/**
 * Filings across the approved engagement ids only. `listComplianceInstances`
 * is deliberately not used: its role branch tests `ctx.role === 'admin'`, so a
 * super admin would fall through to the client scope
 * (`src/db/repositories/compliance.ts`). Scoping by an explicit id list is both
 * correct here and narrower than a role branch.
 */
async function loadFilings(
  scopedDbIds: string[],
  companyByDbId: Map<string, string>,
  now: Date,
): Promise<SuperFiling[]> {
  if (scopedDbIds.length === 0) return [];

  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + SUPER_FILING_HORIZON_DAYS);
  // Overdue filings matter more than upcoming ones, so the window opens behind
  // today as well as ahead of it.
  const floor = new Date(now);
  floor.setDate(floor.getDate() - SUPER_FILING_HORIZON_DAYS);

  const rows = await db
    .select({
      id: complianceInstances.id,
      engagementId: complianceInstances.engagementId,
      obligationId: complianceInstances.obligationId,
      dueDate: complianceInstances.dueDate,
      status: complianceInstances.status,
      periodLabel: complianceInstances.periodLabel,
    })
    .from(complianceInstances)
    .where(
      and(
        inArray(complianceInstances.engagementId, scopedDbIds),
        gte(complianceInstances.dueDate, ymd(floor)),
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
    const appId = appEngagementId(row.engagementId);
    return {
      id: row.id,
      engagementId: appId,
      companyName: companyByDbId.get(row.engagementId) ?? 'Unknown company',
      title: obligation?.particular?.trim() || row.obligationId,
      authority: obligation?.authority?.trim() || 'Other',
      dueDate: row.dueDate,
      status: row.status,
      periodLabel: row.periodLabel?.trim() || undefined,
      href: superEngagementHref(appId),
    };
  });
}

function toActivity(
  rows: Awaited<ReturnType<typeof listAuditEvents>>,
  companyByDbId: Map<string, string>,
): SuperActivityEntry[] {
  return rows
    .filter((row) => !HIDDEN_AUDIT_ACTIONS.has(row.action))
    .slice(0, ACTIVITY_LIMIT)
    .map((row) => {
      const appId = row.engagement_id ? appEngagementId(row.engagement_id) : null;
      return {
        id: row.id,
        at: row.created_at,
        actor: row.actor_name?.trim() || row.actor_email?.trim() || null,
        action: row.action,
        label: row.summary,
        engagementId: appId,
        companyName: row.engagement_id
          ? (companyByDbId.get(row.engagement_id) ?? null)
          : null,
        href: appId ? superEngagementHref(appId) : null,
      };
    });
}

/** The single scoped read behind the super admin observatory. */
export async function getSuperAdminOverview(
  ctx: AuthContext,
  now: Date = new Date(),
): Promise<SuperOverview> {
  assertSuperScope(ctx);

  const [rows, checklistIndex, staff] = await Promise.all([
    listEngagements(ctx),
    listChecklistIndex(ctx),
    listStaffPeople(ctx),
  ]);

  const scopedDbIds = rows.map((row) => row.id);
  const companyByDbId = new Map(rows.map((row) => [row.id, row.companyName]));
  const { byInternId, byProfileId } = nameIndexes(staff);

  const summaries = rows.map((row: EngagementListRow) => {
    const appId = appEngagementId(row.id);
    const state = (checklistIndex[appId] ?? {}) as SuperOverviewState;
    const leadId = row.internId?.trim() || null;
    const managerId = row.managerId ?? row.adminId ?? null;
    return summarizeEngagement(
      {
        id: appId,
        slug: row.slug ?? null,
        companyName: row.companyName,
        clientName: row.clientName?.trim() || null,
        stage: row.stage,
        health: row.health,
        leadId,
        leadName: leadId ? (byInternId.get(leadId) ?? null) : null,
        managerId,
        managerName: managerId ? (byProfileId.get(managerId) ?? null) : null,
        incorporationDate: row.incorporationDate ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        state,
      },
      now,
    );
  });

  const [filings, auditRows] = await Promise.all([
    loadFilings(scopedDbIds, companyByDbId, now),
    listAuditEvents(ctx, { limit: 60 }),
  ]);

  return buildSuperOverview({
    summaries,
    filings,
    activity: toActivity(auditRows, companyByDbId),
    staff,
    clients: staff.filter((person) => person.role === 'client').length,
    now,
  });
}

/* ------------------------------------------------------------------ *
 * L2 — one engagement, in full.
 * ------------------------------------------------------------------ */

/**
 * Everything the observatory shows for one engagement.
 *
 * Access is `assertEngagementAccess`, the same first hop the client overview
 * uses: a caller who may not see this engagement gets `null`, which the route
 * turns into 404 — never a 403 that would confirm the id exists. The firm-wide
 * assertion still runs first, so this is not a way for a narrow role to read a
 * project through the super surface.
 */
export async function getSuperEngagementDetail(
  ctx: AuthContext,
  engagementId: string,
  now: Date = new Date(),
): Promise<SuperEngagementDetail | null> {
  assertSuperScope(ctx);

  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) return null;

  const { row, dbId } = access;
  const appId = appEngagementId(dbId);
  const state = checklistStateFromRow(row) as SuperOverviewState;
  const slugOrId = row.slug ?? appId;

  const [staff, documents, filings, auditRows, recipients] = await Promise.all([
    listStaffPeople(ctx),
    listDocuments(ctx, engagementId),
    loadFilings([dbId], new Map([[dbId, row.companyName]]), now),
    listAuditEvents(ctx, { engagementId: dbId, limit: 60 }),
    resolveEngagementRecipients(dbId),
  ]);

  const { byInternId, byProfileId } = nameIndexes(staff);
  const leadId = row.internId?.trim() || null;
  const managerId = row.managerId ?? row.adminId ?? null;

  const summary = summarizeEngagement(
    {
      id: appId,
      slug: row.slug ?? null,
      companyName: row.companyName,
      clientName: row.clientName?.trim() || null,
      stage: row.stage,
      health: row.health,
      leadId,
      leadName: leadId ? (byInternId.get(leadId) ?? null) : null,
      managerId,
      managerName: managerId ? (byProfileId.get(managerId) ?? null) : null,
      incorporationDate: row.incorporationDate ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      state,
    },
    now,
  );

  const team: SuperTeamMember[] = [];
  const seen = new Set<string>();
  for (const manager of recipients?.managers ?? []) {
    if (seen.has(manager.userId)) continue;
    seen.add(manager.userId);
    team.push({
      id: manager.userId,
      name: manager.name,
      email: manager.email,
      role: 'Project Manager',
    });
  }
  for (const lead of recipients?.leads ?? []) {
    if (seen.has(lead.userId)) continue;
    seen.add(lead.userId);
    team.push({ id: lead.userId, name: lead.name, email: lead.email, role: 'Project Lead' });
  }
  for (const client of recipients?.clients ?? []) {
    if (seen.has(client.userId)) continue;
    seen.add(client.userId);
    team.push({ id: client.userId, name: client.name, email: client.email, role: 'Client' });
  }

  return {
    summary,
    journey: buildJourney(state, slugOrId),
    documents: documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      category: doc.category,
      stepId: doc.stepId,
      sharedWithClient: doc.sharedWithClient,
      createdAt: doc.createdAt,
      sizeBytes: doc.sizeBytes,
    })),
    filings,
    activity: toActivity(auditRows, new Map([[dbId, row.companyName]])),
    team,
    enterAs: {
      firm: superFirmViewHref(slugOrId),
      client: '/app/client/overview',
    },
  };
}
