import 'server-only';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { invites } from '@/db/schema';
import type { AuthContext } from '@/auth/guards';
import type { Invite } from '@/data/engagements';
import {
  assertEngagementAccess,
  listEngagements,
} from '@/db/repositories/engagements';
import { LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';

/**
 * INVITES REPOSITORY — replaces vcfo.invites localStorage.
 *
 * Access: admin all; manager via owned engagements; intern via assigned
 * engagements; clients see invites for their own engagement.
 */

type Row = typeof invites.$inferSelect;

function appEngagementId(dbId: string | null): string {
  if (!dbId) return '';
  return LEGACY_ENGAGEMENT_IDS[dbId] ?? dbId;
}

export function toAppInvite(row: Row): Invite {
  return {
    token: row.token,
    engagementId: appEngagementId(row.engagementId),
    email: row.email,
    createdAt: row.createdAt.toISOString(),
    usedAt: row.acceptedAt ? row.acceptedAt.toISOString() : undefined,
  };
}

async function scopedEngagementIds(ctx: AuthContext): Promise<string[] | 'all'> {
  if (ctx.role === 'admin') return 'all';
  const rows = await listEngagements(ctx);
  return rows.map((r) => r.id);
}

export async function listInvites(ctx: AuthContext): Promise<Invite[]> {
  const scope = await scopedEngagementIds(ctx);
  if (scope !== 'all' && scope.length === 0) return [];

  const rows =
    scope === 'all'
      ? await db.select().from(invites).orderBy(desc(invites.createdAt))
      : await db
          .select()
          .from(invites)
          .where(inArray(invites.engagementId, scope))
          .orderBy(desc(invites.createdAt));

  return rows.map(toAppInvite);
}

export async function getInviteByToken(
  ctx: AuthContext,
  token: string,
): Promise<Invite | null> {
  const [row] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!row) return null;
  if (row.engagementId) {
    const access = await assertEngagementAccess(ctx, row.engagementId);
    if (!access.ok) return null;
  } else if (ctx.role !== 'admin' && ctx.role !== 'manager') {
    return null;
  }
  return toAppInvite(row);
}

export async function createInvite(
  ctx: AuthContext,
  input: { engagementId: string; email: string; token?: string },
): Promise<Invite> {
  if (ctx.role === 'client') {
    throw new Error('Clients may not create invites');
  }
  const access = await assertEngagementAccess(ctx, input.engagementId);
  if (!access.ok) throw new Error('Engagement not found or not permitted');

  const token =
    input.token?.trim() ||
    `inv_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

  const [row] = await db
    .insert(invites)
    .values({
      token,
      email: input.email.trim().toLowerCase(),
      role: 'client',
      engagementId: access.dbId,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning();
  return toAppInvite(row);
}

export async function acceptInviteByToken(
  _ctx: AuthContext,
  token: string,
): Promise<Invite | null> {
  const [existing] = await db.select().from(invites).where(eq(invites.token, token)).limit(1);
  if (!existing) return null;
  if (existing.acceptedAt) return toAppInvite(existing);

  const [row] = await db
    .update(invites)
    .set({ acceptedAt: new Date() })
    .where(eq(invites.token, token))
    .returning();
  return row ? toAppInvite(row) : null;
}
