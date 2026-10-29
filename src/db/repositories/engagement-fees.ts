import 'server-only';

import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { engagementFees } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import { isAdminOrManager } from '@/lib/auth';
import { engagementDbId } from '@/lib/projects/legacy-engagement-ids';
import { getEngagementById } from '@/db/repositories/engagements';
import { recordAuditEvent } from '@/db/repositories/audit-events';

/**
 * ENGAGEMENT FEES REPOSITORY (P-100) — the fee lines on one engagement, by service, and what is
 * outstanding on them.
 *
 * >>> ACCESS CONTROL (Path A) <<<
 *   Super admin, admin and the engagement's manager only. The role is checked first (a lead, a
 *   client or the developer is refused before any read); the engagement is then read through
 *   `getEngagementById`, which scopes by role, so a foreign engagement is "not found" and nothing
 *   is read or written. Every write is filtered by the approved engagement id as well as the line
 *   id, and writes an audit event.
 */

export const FEE_BILLING = ['one_time', 'monthly', 'milestone'] as const;
export const FEE_STATUS = ['not_billed', 'billed', 'paid'] as const;
export type FeeBilling = (typeof FEE_BILLING)[number];
export type FeeStatus = (typeof FEE_STATUS)[number];

export interface EngagementFee {
  id: string;
  service: string;
  amountRupees: number;
  billing: FeeBilling;
  status: FeeStatus;
  billedOn: string | null;
  paidOn: string | null;
  createdAt: string;
}

export interface FeeInput {
  service: string;
  amountRupees: number;
  billing: FeeBilling;
  status: FeeStatus;
  billedOn?: string | null;
  paidOn?: string | null;
}

function assertFeeRole(ctx: AuthContext): void {
  if (!isAdminOrManager(ctx.role)) {
    throw new Error('Only an admin or the manager may see fees');
  }
}

async function requireEngagement(ctx: AuthContext, appOrDbId: string) {
  assertFeeRole(ctx);
  const row = await getEngagementById(ctx, engagementDbId(appOrDbId));
  if (!row) throw new Error('Engagement not found or not permitted');
  return row;
}

function mapRow(row: typeof engagementFees.$inferSelect): EngagementFee {
  return {
    id: row.id,
    service: row.service,
    amountRupees: row.amountRupees,
    billing: (FEE_BILLING as readonly string[]).includes(row.billing) ? (row.billing as FeeBilling) : 'one_time',
    status: (FEE_STATUS as readonly string[]).includes(row.status) ? (row.status as FeeStatus) : 'not_billed',
    billedOn: row.billedOn ?? null,
    paidOn: row.paidOn ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** A billed line keeps its billed day; a paid line keeps both; an unbilled line has neither. */
function datesFor(input: FeeInput, today: string): { billedOn: string | null; paidOn: string | null } {
  if (input.status === 'not_billed') return { billedOn: null, paidOn: null };
  const billedOn = input.billedOn || today;
  if (input.status === 'billed') return { billedOn, paidOn: null };
  return { billedOn, paidOn: input.paidOn || today };
}

export async function listEngagementFees(ctx: AuthContext, appOrDbId: string): Promise<EngagementFee[]> {
  const engagement = await requireEngagement(ctx, appOrDbId);
  const rows = await db
    .select()
    .from(engagementFees)
    .where(eq(engagementFees.engagementId, engagement.id))
    .orderBy(asc(engagementFees.createdAt));
  return rows.map(mapRow);
}

export async function addEngagementFee(
  ctx: AuthContext,
  appOrDbId: string,
  input: FeeInput,
  today = new Date().toISOString().slice(0, 10),
): Promise<EngagementFee> {
  const engagement = await requireEngagement(ctx, appOrDbId);
  const [row] = await db
    .insert(engagementFees)
    .values({
      engagementId: engagement.id,
      service: input.service.trim(),
      amountRupees: Math.round(input.amountRupees),
      billing: input.billing,
      status: input.status,
      ...datesFor(input, today),
      createdBy: ctx.userId,
    })
    .returning();
  if (!row) throw new Error('Could not add the fee');
  await recordAuditEvent(ctx, {
    engagementId: engagement.id,
    action: 'fees.add',
    summary: `Fee added: ${row.service}`,
    actorEmail: ctx.email,
    actorName: ctx.name,
    metadata: { feeId: row.id, amountRupees: row.amountRupees, status: row.status },
  });
  return mapRow(row);
}

export async function updateEngagementFee(
  ctx: AuthContext,
  appOrDbId: string,
  feeId: string,
  input: FeeInput,
  today = new Date().toISOString().slice(0, 10),
): Promise<EngagementFee> {
  const engagement = await requireEngagement(ctx, appOrDbId);
  const [row] = await db
    .update(engagementFees)
    .set({
      service: input.service.trim(),
      amountRupees: Math.round(input.amountRupees),
      billing: input.billing,
      status: input.status,
      ...datesFor(input, today),
      updatedAt: new Date(),
    })
    .where(and(eq(engagementFees.id, feeId), eq(engagementFees.engagementId, engagement.id)))
    .returning();
  if (!row) throw new Error('Fee not found');
  await recordAuditEvent(ctx, {
    engagementId: engagement.id,
    action: 'fees.update',
    summary: `Fee changed: ${row.service}`,
    actorEmail: ctx.email,
    actorName: ctx.name,
    metadata: { feeId: row.id, amountRupees: row.amountRupees, status: row.status },
  });
  return mapRow(row);
}

export async function deleteEngagementFee(ctx: AuthContext, appOrDbId: string, feeId: string): Promise<void> {
  const engagement = await requireEngagement(ctx, appOrDbId);
  const [row] = await db
    .delete(engagementFees)
    .where(and(eq(engagementFees.id, feeId), eq(engagementFees.engagementId, engagement.id)))
    .returning();
  if (!row) throw new Error('Fee not found');
  await recordAuditEvent(ctx, {
    engagementId: engagement.id,
    action: 'fees.delete',
    summary: `Fee removed: ${row.service}`,
    actorEmail: ctx.email,
    actorName: ctx.name,
    metadata: { feeId: row.id },
  });
}
