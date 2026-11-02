import 'server-only';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents } from '@/db/schema';
import { devDeployImages } from '@/db/schema-firm';
import type { AuthContext } from '@/auth/guards';
import type { DeployImage, MigrationRow } from '@/lib/dev/types';
import { assertDeveloper } from './dev-scope';

/**
 * DEV DEPLOYS — the images the production service has run (`dev_deploy_images`, for "Roll
 * back"), the migrations applied to this database, and who last started a deploy (G-01).
 *
 * Access: developer or super admin only. Nothing here names a client.
 */

/** Note that the service runs `image` now: insert it, or move its last-seen time. */
export async function recordDeployImageForDev(ctx: AuthContext, image: string, now = new Date()): Promise<void> {
  assertDeveloper(ctx);
  if (!image) return;
  await db
    .insert(devDeployImages)
    .values({ image, firstSeenAt: now, lastSeenAt: now })
    .onConflictDoUpdate({ target: devDeployImages.image, set: { lastSeenAt: now } });
}

/** Every image seen, newest first; `current` marks the one the service runs now. */
export async function listDeployImagesForDev(ctx: AuthContext, current: string | null): Promise<DeployImage[]> {
  assertDeveloper(ctx);
  const rows = await db.select().from(devDeployImages).orderBy(desc(devDeployImages.lastSeenAt)).limit(50);
  return rows.map((r) => ({
    image: r.image,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
    current: r.image === current,
  }));
}

/** True when the image is one the console has seen the service run (a roll back target). */
export async function isKnownDeployImageForDev(ctx: AuthContext, image: string): Promise<boolean> {
  assertDeveloper(ctx);
  const [row] = await db.select({ image: devDeployImages.image }).from(devDeployImages).where(eq(devDeployImages.image, image)).limit(1);
  return Boolean(row);
}

export interface JournalEntry {
  tag: string;
  when: number;
}

/**
 * Migrations in the code's journal against drizzle-kit's table (`drizzle.__drizzle_migrations`,
 * whose `created_at` is the journal's `when`). drizzle-kit applies every entry newer than
 * the last row, so an entry at or before the newest row counts as applied. The table keeps
 * no time of applying, so `appliedAt` is the migration's own date.
 */
export async function listMigrationsForDev(ctx: AuthContext, journal: JournalEntry[]): Promise<MigrationRow[]> {
  assertDeveloper(ctx);
  const res = await db.execute(sql`select coalesce(max(created_at), 0)::bigint as last from drizzle.__drizzle_migrations`);
  const last = Number((res.rows[0] as { last?: string | number } | undefined)?.last ?? 0) || 0;
  return [...journal]
    .sort((a, b) => b.when - a.when)
    .map((e) => ({
      tag: e.tag,
      status: e.when <= last ? 'applied' : 'pending',
      appliedAt: e.when <= last ? new Date(e.when).toISOString() : null,
    }));
}

/** The last console redeploy or roll back: who and when, from the audit log. */
export async function lastDeployActorForDev(ctx: AuthContext): Promise<{ name: string; at: string } | null> {
  assertDeveloper(ctx);
  const [row] = await db
    .select({ name: auditEvents.actorName, email: auditEvents.actorEmail, at: auditEvents.createdAt })
    .from(auditEvents)
    .where(and(inArray(auditEvents.action, ['dev.deploy.start', 'dev.deploy.rollback']), eq(auditEvents.result, 'ok')))
    .orderBy(desc(auditEvents.createdAt))
    .limit(1);
  if (!row) return null;
  return { name: row.name?.trim() || row.email?.split('@')[0] || 'Staff', at: row.at.toISOString() };
}
