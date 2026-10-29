import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db/client';
import type { AuthContext } from '@/auth/guards';
import type { TableStat } from '@/lib/dev/types';
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
