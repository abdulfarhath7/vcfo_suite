import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import type { AuthContext } from '@/auth/guards';
import type { DatabaseFacts, MonthVolumes, TableStat } from '@/lib/dev/types';
import { assertDeveloper } from './dev-scope';

/**
 * DEV DATA — table sizes for the developer console (G-01). Reads Postgres catalog numbers
 * only (`pg_class` row estimates and `pg_total_relation_size`), never a row of data.
 *
 * Access: developer or super admin only.
 */
export async function getDatabaseStatsForDev(ctx: AuthContext): Promise<{ bytes: number; tables: TableStat[] }> {
  assertDeveloper(ctx);

  const [tablesRes, sizeRes] = await Promise.all([
    db.execute(sql`
      select c.relname as name,
             greatest(c.reltuples, 0)::bigint as rows,
             pg_total_relation_size(c.oid)::bigint as bytes
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
       order by pg_total_relation_size(c.oid) desc
       limit 200
    `),
    db.execute(sql`select pg_database_size(current_database())::bigint as bytes`),
  ]);

  const tables = (tablesRes.rows as Array<{ name: string; rows: string | number; bytes: string | number }>).map((r) => ({
    name: String(r.name),
    rows: Number(r.rows) || 0,
    bytes: Number(r.bytes) || 0,
  }));
  const bytes = Number((sizeRes.rows[0] as { bytes?: string | number } | undefined)?.bytes ?? 0) || 0;
  return { bytes, tables };
}


/**
 * Database facts from the Postgres catalog and statistics views: version, start time,
 * connections, size, the oldest vacuum and dead row count. No row of data is read.
 */
export async function getDatabaseFactsForDev(ctx: AuthContext): Promise<DatabaseFacts> {
  assertDeveloper(ctx);
  const res = await db.execute(sql`
    select current_setting('server_version') as version,
           pg_postmaster_start_time() as started,
           (select count(*) from pg_stat_activity where datname = current_database())::int as connections,
           current_setting('max_connections')::int as max_connections,
           pg_database_size(current_database())::bigint as bytes,
           (select min(greatest(last_vacuum, last_autovacuum)) from pg_stat_user_tables where schemaname = 'public') as oldest_vacuum,
           (select coalesce(sum(n_dead_tup), 0) from pg_stat_user_tables where schemaname = 'public')::bigint as dead_rows
  `);
  const r = (res.rows[0] ?? {}) as Record<string, unknown>;
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    version: String(r.version ?? ''),
    startedAt: iso(r.started),
    connections: Number(r.connections ?? 0) || 0,
    maxConnections: Number(r.max_connections ?? 0) || 0,
    bytes: Number(r.bytes ?? 0) || 0,
    oldestVacuum: iso(r.oldest_vacuum),
    deadRows: Number(r.dead_rows ?? 0) || 0,
  };
}


/** Counts for this month so far, from the app's own tables. Counts only, no rows. */
export async function getMonthVolumesForDev(ctx: AuthContext, now = new Date()): Promise<MonthVolumes> {
  assertDeveloper(ctx);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const res = await db.execute(sql`
    select
      (select count(*) from notification_deliveries where channel = 'email' and status <> 'skipped' and created_at >= ${since})::int as emails,
      (select count(*) from notification_deliveries where channel = 'whatsapp' and status <> 'skipped' and created_at >= ${since})::int as whatsapp,
      (select count(*) from documents where created_at >= ${since})::int as documents,
      (select coalesce(sum(size_bytes), 0) from documents where created_at >= ${since})::bigint as document_bytes,
      (select count(*) from audit_events where created_at >= ${since})::int as audit_events,
      (select count(*) from user_sessions where created_at >= ${since})::int as sign_ins
  `);
  const r = (res.rows[0] ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(r[k] ?? 0) || 0;
  return {
    since: since.toISOString(),
    emails: n('emails'),
    whatsapp: n('whatsapp'),
    documents: n('documents'),
    documentBytes: n('document_bytes'),
    auditEvents: n('audit_events'),
    signIns: n('sign_ins'),
  };
}
