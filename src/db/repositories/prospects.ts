import 'server-only';

import { desc, eq, inArray, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { profiles, prospects } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { assertEngagementAccess } from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { getDemoRequest, markDemoRequestProspect } from '@/db/repositories/demo-requests';
import {
  asProspectService,
  asProspectSource,
  closedAtForMove,
  isProspectStage,
  type Prospect,
  type ProspectService,
  type ProspectSource,
  type ProspectStage,
} from '@/lib/growth/pipeline';

/**
 * PROSPECTS — the Growth sales pipeline (G-21).
 *
 * Super admin only, for reads and writes alike: every other role is refused before the first
 * query. The check is `ctx.role === 'super_admin'` on purpose; `isFirmWideAdmin` would let a
 * firm admin in, and the pipeline is the partner's own book. Every change writes an audit
 * event (R-40). "Convert to client" only links a won prospect to an engagement the caller can
 * see (`assertEngagementAccess`); it never creates an engagement. No fee amounts (R-37).
 */

/** Profiles that may own a prospect. */
const OWNER_ROLES = ['super_admin', 'admin', 'manager'] as const;

function assertSuper(ctx: AuthContext): void {
  if (ctx.role !== 'super_admin') {
    throw new Error('Only the super admin may use the sales pipeline');
  }
}

type Row = typeof prospects.$inferSelect;

function toProspect(r: Row, ownerName: string | null): Prospect {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    email: r.email,
    phone: r.phone,
    source: asProspectSource(r.source),
    stage: isProspectStage(r.stage) ? r.stage : 'lead',
    service: asProspectService(r.service),
    ownerId: r.ownerId,
    ownerName,
    notes: r.notes,
    nextStepOn: r.nextStepOn ?? null,
    closedAt: r.closedAt ? r.closedAt.toISOString() : null,
    engagementId: r.engagementId,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

async function ownerNames(ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.id, unique));
  return new Map(rows.map((r) => [r.id, r.name?.trim() || r.email]));
}

/** Refuses an owner who is not a staff member allowed to hold a prospect. */
async function assertOwner(ownerId: string | null | undefined): Promise<void> {
  if (!ownerId) return;
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(and(eq(profiles.id, ownerId), inArray(profiles.role, [...OWNER_ROLES])))
    .limit(1);
  if (!row) throw new Error('invalid_owner');
}

export async function listProspects(ctx: AuthContext): Promise<Prospect[]> {
  assertSuper(ctx);
  const rows = await db.select().from(prospects).orderBy(desc(prospects.updatedAt));
  const names = await ownerNames(rows.map((r) => r.ownerId));
  return rows.map((r) => toProspect(r, r.ownerId ? names.get(r.ownerId) ?? null : null));
}

export async function getProspect(ctx: AuthContext, id: string): Promise<Prospect | null> {
  assertSuper(ctx);
  const [row] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!row) return null;
  const names = await ownerNames([row.ownerId]);
  return toProspect(row, row.ownerId ? names.get(row.ownerId) ?? null : null);
}

/** Staff who may own a prospect, for the owner picker. */
export async function listProspectOwners(ctx: AuthContext): Promise<Array<{ id: string; name: string; role: string }>> {
  assertSuper(ctx);
  const rows = await db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email, role: profiles.role, status: profiles.status })
    .from(profiles)
    .where(inArray(profiles.role, [...OWNER_ROLES]));
  return rows
    .filter((r) => r.status !== 'removed' && r.status !== 'disabled')
    .map((r) => ({ id: r.id, name: r.name?.trim() || r.email, role: r.role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ProspectInput {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: ProspectSource;
  stage?: ProspectStage;
  service?: ProspectService | null;
  ownerId?: string | null;
  notes?: string | null;
  nextStepOn?: string | null;
}

export async function createProspect(ctx: AuthContext, input: ProspectInput): Promise<Prospect> {
  assertSuper(ctx);
  await assertOwner(input.ownerId);
  const now = new Date();
  const stage = input.stage ?? 'lead';
  const [row] = await db
    .insert(prospects)
    .values({
      name: input.name,
      company: input.company ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      source: input.source ?? 'other',
      stage,
      service: input.service ?? null,
      ownerId: input.ownerId ?? null,
      notes: input.notes ?? null,
      nextStepOn: input.nextStepOn ?? null,
      closedAt: closedAtForMove('lead', stage, null, now),
      createdBy: ctx.userId,
    })
    .returning();
  if (!row) throw new Error('insert_failed');
  await recordAuditEvent(ctx, {
    action: 'prospect.create',
    summary: `Added ${row.name} to the sales pipeline`,
    metadata: { prospectId: row.id, stage, source: row.source },
  });
  const names = await ownerNames([row.ownerId]);
  return toProspect(row, row.ownerId ? names.get(row.ownerId) ?? null : null);
}

export type ProspectPatch = Partial<ProspectInput>;

export async function updateProspect(ctx: AuthContext, id: string, patch: ProspectPatch): Promise<Prospect | null> {
  assertSuper(ctx);
  const [current] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!current) return null;
  if (patch.ownerId !== undefined) await assertOwner(patch.ownerId);

  const now = new Date();
  const from: ProspectStage = isProspectStage(current.stage) ? current.stage : 'lead';
  const to: ProspectStage = patch.stage ?? from;
  const set: Partial<typeof prospects.$inferInsert> = { updatedAt: now };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.company !== undefined) set.company = patch.company;
  if (patch.email !== undefined) set.email = patch.email;
  if (patch.phone !== undefined) set.phone = patch.phone;
  if (patch.source !== undefined) set.source = patch.source;
  if (patch.service !== undefined) set.service = patch.service;
  if (patch.ownerId !== undefined) set.ownerId = patch.ownerId;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.nextStepOn !== undefined) set.nextStepOn = patch.nextStepOn;
  if (to !== from) {
    set.stage = to;
    set.closedAt = closedAtForMove(from, to, current.closedAt, now);
  }

  const [row] = await db.update(prospects).set(set).where(eq(prospects.id, id)).returning();
  if (!row) return null;
  await recordAuditEvent(ctx, {
    action: to !== from ? 'prospect.stage' : 'prospect.update',
    summary: to !== from ? `Moved ${row.name} from ${from} to ${to}` : `Edited prospect ${row.name}`,
    metadata: { prospectId: row.id, from, to, fields: Object.keys(patch) },
  });
  const names = await ownerNames([row.ownerId]);
  return toProspect(row, row.ownerId ? names.get(row.ownerId) ?? null : null);
}

/**
 * Link a won prospect to an engagement the super admin picked. The engagement must exist and
 * be visible to the caller; the link is written against the approved database id.
 */
export async function convertProspect(
  ctx: AuthContext,
  id: string,
  engagementId: string,
): Promise<Prospect | null> {
  assertSuper(ctx);
  const [current] = await db.select().from(prospects).where(eq(prospects.id, id)).limit(1);
  if (!current) return null;
  if (current.stage !== 'won') throw new Error('not_won');
  const access = await assertEngagementAccess(ctx, engagementId);
  if (!access.ok) throw new Error('engagement_not_found');

  const [row] = await db
    .update(prospects)
    .set({ engagementId: access.dbId, updatedAt: new Date() })
    .where(eq(prospects.id, id))
    .returning();
  if (!row) return null;
  await recordAuditEvent(ctx, {
    action: 'prospect.convert',
    engagementId: access.dbId,
    summary: `Linked won prospect ${row.name} to ${access.row.companyName}`,
    metadata: { prospectId: row.id, engagementId: access.dbId },
  });
  const names = await ownerNames([row.ownerId]);
  return toProspect(row, row.ownerId ? names.get(row.ownerId) ?? null : null);
}

/**
 * "Add as prospect" on a demo request: a new lead with the request's details, source
 * `demo_request`, and the request marked so it is not added twice.
 */
export async function createProspectFromDemoRequest(
  ctx: AuthContext,
  demoRequestId: string,
  opts: { ownerId?: string | null } = {},
): Promise<Prospect | null> {
  assertSuper(ctx);
  const request = await getDemoRequest(ctx, demoRequestId);
  if (!request) return null;
  if (request.prospectId) throw new Error('already_added');
  const prospect = await createProspect(ctx, {
    name: request.name,
    company: request.company,
    email: request.email,
    phone: request.phone,
    notes: request.message,
    source: 'demo_request',
    stage: 'lead',
    ownerId: opts.ownerId ?? ctx.userId,
  });
  await markDemoRequestProspect(ctx, demoRequestId, prospect.id);
  return prospect;
}
