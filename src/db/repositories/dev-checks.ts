import 'server-only';
import { and, desc, eq, gte, like, or, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { auditEvents, profiles } from '@/db/schema';
import { devServiceChecks } from '@/db/schema-firm';
import type { AuthContext } from '@/auth/guards';
import type { ServiceCheck } from '@/lib/dev/types';
import { scrubText } from '@/lib/dev/mask';
import { assertDeveloper } from './dev-scope';

/**
 * DEV CHECKS — stored live checks of the outside services (`dev_service_checks`), and the
 * connection events built from them and from the console's audit rows (G-01).
 *
 * Access: developer or super admin only. A check row holds a service id, pass or fail, the
 * time it took and a scrubbed line; it never holds a secret or a client's details.
 */

const MAX_DETAIL = 200;

export async function recordServiceCheckForDev(
  ctx: AuthContext,
  input: { service: string; ok: boolean; latencyMs: number; detail: string | null },
): Promise<ServiceCheck> {
  assertDeveloper(ctx);
  const detail = input.detail ? scrubText(input.detail).slice(0, MAX_DETAIL) : null;
  const [row] = await db
    .insert(devServiceChecks)
    .values({ service: input.service, ok: input.ok, latencyMs: Math.max(0, Math.round(input.latencyMs)), detail, checkedBy: ctx.userId })
    .returning({ id: devServiceChecks.id, checkedAt: devServiceChecks.checkedAt });
  return {
    id: row?.id ?? '',
    service: input.service,
    ok: input.ok,
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    detail,
    checkedAt: (row?.checkedAt ?? new Date()).toISOString(),
    by: ctx.name || null,
  };
}

/**
 * SYSTEM WRITER — the scheduled `service-checks` job, which no person runs. The row has no
 * `checked_by` and reads as "System" on the console.
 */
export async function systemRecordServiceCheck(input: { service: string; ok: boolean; latencyMs: number; detail: string | null }): Promise<void> {
  const detail = input.detail ? scrubText(input.detail).slice(0, MAX_DETAIL) : null;
  await db.insert(devServiceChecks).values({ service: input.service, ok: input.ok, latencyMs: Math.max(0, Math.round(input.latencyMs)), detail, checkedBy: null });
}

/** Checks of the last `days` days (newest first, at most 5,000), for uptime, p95 and incidents. */
export async function listServiceChecksForDev(ctx: AuthContext, opts: { days?: number; service?: string } = {}): Promise<ServiceCheck[]> {
  assertDeveloper(ctx);
  const days = Math.min(Math.max(opts.days ?? 30, 1), 90);
  const since = new Date(Date.now() - days * 86400000);
  const where = opts.service
    ? and(gte(devServiceChecks.checkedAt, since), eq(devServiceChecks.service, opts.service))
    : gte(devServiceChecks.checkedAt, since);
  const rows = await db
    .select({
      id: devServiceChecks.id,
      service: devServiceChecks.service,
      ok: devServiceChecks.ok,
      latencyMs: devServiceChecks.latencyMs,
      detail: devServiceChecks.detail,
      checkedAt: devServiceChecks.checkedAt,
      checkedBy: devServiceChecks.checkedBy,
      by: profiles.name,
    })
    .from(devServiceChecks)
    .leftJoin(profiles, eq(profiles.id, devServiceChecks.checkedBy))
    .where(where)
    .orderBy(desc(devServiceChecks.checkedAt))
    .limit(5000);
  return rows.map((r) => ({
    id: r.id,
    service: r.service,
    ok: r.ok,
    latencyMs: r.latencyMs,
    detail: r.detail,
    checkedAt: r.checkedAt.toISOString(),
    // A scheduled check has no person; it reads as "System".
    by: r.checkedBy === null ? 'System' : (r.by ?? null),
  }));
}

/**
 * The last events for one service: its checks, and the console audit rows that name it
 * (`dev.connection.*` with `metadata.service`, for example a test send). Newest first.
 */
export async function listConnectionEventsForDev(
  ctx: AuthContext,
  service: string,
  limit = 5,
): Promise<Array<{ id: string; at: string; text: string; ok: boolean }>> {
  assertDeveloper(ctx);
  const [checks, audits] = await Promise.all([
    listServiceChecksForDev(ctx, { days: 90, service }),
    db
      .select({ id: auditEvents.id, at: auditEvents.createdAt, summary: auditEvents.summary, result: auditEvents.result })
      .from(auditEvents)
      .where(
        and(
          or(like(auditEvents.action, 'dev.connection.%'), like(auditEvents.action, 'dev.outlook.%')),
          sql`${auditEvents.metadata}->>'service' = ${service}`,
        ),
      )
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit),
  ]);
  const events = [
    ...checks.slice(0, limit).map((c) => ({
      id: `check-${c.id}`,
      at: c.checkedAt,
      text: `${c.ok ? 'Test passed' : 'Test failed'}${c.detail ? `: ${c.detail}` : ''}`,
      ok: c.ok,
    })),
    ...audits.map((a) => ({ id: `audit-${a.id}`, at: a.at.toISOString(), text: a.summary, ok: a.result === 'ok' })),
  ];
  return events.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
