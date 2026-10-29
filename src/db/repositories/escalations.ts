import 'server-only';

import { and, desc, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagements, escalations, profiles } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isFirmWideAdmin } from '@/lib/auth';
import { appEngagementId } from '@/lib/projects/legacy-engagement-ids';
import { assertEngagementAccess, listScopedEngagementIds } from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * ESCALATIONS REPOSITORY (G-20) — an engagement raised to the super admin or an admin.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   list    — firm-wide admins (super admin, admin): every escalation. Managers and project
 *             leads: escalations on the engagements in their own scope
 *             (`listScopedEngagementIds`). Clients and the developer role: refused.
 *   raise   — any staff role, on an engagement the caller can access (`assertEngagementAccess`);
 *             the row is written against the approved engagement id. The person it goes to
 *             must be an admin or the super admin; none means the super admin.
 *   resolve — firm-wide admins only, with a note.
 *
 * Soft-deleted engagements are hidden, as `scopeFor()` hides them. Each raise and resolve
 * writes an audit event (R-40).
 */

const STAFF_ROLES = new Set(['super_admin', 'admin', 'manager', 'intern']);

export class EscalationForbiddenError extends Error {
  constructor(message = 'Not permitted') {
    super(message);
    this.name = 'EscalationForbiddenError';
  }
}

export type EscalationStatus = 'open' | 'resolved';

export interface Escalation {
  id: string;
  /** App engagement id (legacy `e1`… or uuid), what every href uses. */
  engagementId: string;
  companyName: string;
  reason: string;
  status: EscalationStatus;
  raisedById: string | null;
  raisedByName: string | null;
  assignedToId: string | null;
  /** Null means the super admin. */
  assignedToName: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

function assertStaff(ctx: AuthContext): void {
  if (!STAFF_ROLES.has(ctx.role)) throw new EscalationForbiddenError('Only staff may see escalations');
}

const selectFields = {
  id: escalations.id,
  engagementId: escalations.engagementId,
  companyName: engagements.companyName,
  reason: escalations.reason,
  status: escalations.status,
  raisedBy: escalations.raisedBy,
  assignedTo: escalations.assignedTo,
  resolvedBy: escalations.resolvedBy,
  resolvedAt: escalations.resolvedAt,
  resolutionNote: escalations.resolutionNote,
  createdAt: escalations.createdAt,
};

type SelectedRow = {
  id: string;
  engagementId: string;
  companyName: string;
  reason: string;
  status: string;
  raisedBy: string | null;
  assignedTo: string | null;
  resolvedBy: string | null;
  resolvedAt: Date | null;
  resolutionNote: string | null;
  createdAt: Date;
};

/** Display names for the people on a set of rows, in one query. */
async function namesFor(rows: SelectedRow[]): Promise<Map<string, string>> {
  const ids = [
    ...new Set(rows.flatMap((r) => [r.raisedBy, r.assignedTo, r.resolvedBy]).filter(Boolean) as string[]),
  ];
  if (ids.length === 0) return new Map();
  const people = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  return new Map(people.map((p) => [p.id, p.name?.trim() || p.email]));
}

function toEscalation(row: SelectedRow, names: Map<string, string>): Escalation {
  return {
    id: row.id,
    engagementId: appEngagementId(row.engagementId),
    companyName: row.companyName,
    reason: row.reason,
    status: row.status === 'resolved' ? 'resolved' : 'open',
    raisedById: row.raisedBy,
    raisedByName: row.raisedBy ? (names.get(row.raisedBy) ?? null) : null,
    assignedToId: row.assignedTo,
    assignedToName: row.assignedTo ? (names.get(row.assignedTo) ?? null) : null,
    resolvedByName: row.resolvedBy ? (names.get(row.resolvedBy) ?? null) : null,
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface ListEscalationsOptions {
  status?: EscalationStatus | 'all';
  /** App or db engagement id. */
  engagementId?: string;
}

/** Escalations the caller may see, open first and newest first within each. */
export async function listEscalations(
  ctx: AuthContext,
  options: ListEscalationsOptions = {},
): Promise<Escalation[]> {
  assertStaff(ctx);

  const conditions: SQL[] = [isNull(engagements.deletedAt)];
  if (options.status && options.status !== 'all') conditions.push(eq(escalations.status, options.status));

  if (options.engagementId) {
    const access = await assertEngagementAccess(ctx, options.engagementId);
    if (!access.ok) return [];
    conditions.push(eq(escalations.engagementId, access.dbId));
  } else if (!isFirmWideAdmin(ctx.role)) {
    const scoped = await listScopedEngagementIds(ctx);
    if (scoped.length === 0) return [];
    conditions.push(inArray(escalations.engagementId, scoped));
  }

  const rows = (await db
    .select(selectFields)
    .from(escalations)
    .innerJoin(engagements, eq(engagements.id, escalations.engagementId))
    .where(and(...conditions))
    .orderBy(desc(escalations.createdAt))
    .limit(200)) as SelectedRow[];

  const names = await namesFor(rows);
  return rows
    .map((row) => toEscalation(row, names))
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1));
}

export interface RaiseEscalationInput {
  engagementId: string;
  reason: string;
  /** An admin or super admin profile id; null or absent means the super admin. */
  assignedTo?: string | null;
}

/** Any staff role, on an engagement they can access. */
export async function raiseEscalation(ctx: AuthContext, input: RaiseEscalationInput): Promise<Escalation> {
  assertStaff(ctx);
  const reason = input.reason.trim();
  if (!reason) throw new Error('reason_required');

  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) throw new EscalationForbiddenError('Engagement not found or not permitted');

  let assignedTo: string | null = null;
  if (input.assignedTo) {
    const [target] = await db
      .select({ id: profiles.id, role: profiles.role })
      .from(profiles)
      .where(eq(profiles.id, input.assignedTo))
      .limit(1);
    if (!target || !isFirmWideAdmin(target.role)) throw new Error('assignee_not_admin');
    assignedTo = target.id;
  }

  const [row] = await db
    .insert(escalations)
    .values({ engagementId: access.dbId, raisedBy: ctx.userId, assignedTo, reason, status: 'open' })
    .returning();

  await recordAuditEvent(ctx, {
    engagementId: access.dbId,
    action: 'escalation.raise',
    summary: `Escalated ${access.row.companyName}: ${reason.slice(0, 120)}`,
    metadata: { escalationId: row.id, assignedTo },
  });

  const selected: SelectedRow = { ...row, companyName: access.row.companyName };
  return toEscalation(selected, await namesFor([selected]));
}

/** Firm-wide admins: close an open escalation with a note. Returns null when it is not there. */
export async function resolveEscalation(
  ctx: AuthContext,
  id: string,
  note: string,
): Promise<Escalation | null> {
  if (!isFirmWideAdmin(ctx.role)) throw new EscalationForbiddenError('Only admins may resolve escalations');
  const text = note.trim();
  if (!text) throw new Error('note_required');

  const [existing] = (await db
    .select(selectFields)
    .from(escalations)
    .innerJoin(engagements, eq(engagements.id, escalations.engagementId))
    .where(and(eq(escalations.id, id), isNull(engagements.deletedAt)))
    .limit(1)) as SelectedRow[];
  if (!existing) return null;
  if (existing.status === 'resolved') throw new Error('already_resolved');

  const now = new Date();
  await db
    .update(escalations)
    .set({ status: 'resolved', resolvedBy: ctx.userId, resolvedAt: now, resolutionNote: text })
    .where(eq(escalations.id, id));

  await recordAuditEvent(ctx, {
    engagementId: existing.engagementId,
    action: 'escalation.resolve',
    summary: `Resolved the escalation on ${existing.companyName}`,
    metadata: { escalationId: id, note: text },
  });

  const resolved: SelectedRow = {
    ...existing,
    status: 'resolved',
    resolvedBy: ctx.userId,
    resolvedAt: now,
    resolutionNote: text,
  };
  return toEscalation(resolved, await namesFor([resolved]));
}
