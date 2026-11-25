/**
 * The demo database (PLAN H2, docs/context/notes/demo-data.md "Demo logins"): create it when it
 * is missing and bring it to the latest migration. Shared by `npm run db:migrate-demo` and
 * `npm run db:seed-demo-logins`.
 *
 * The demo database sits on the same Postgres server as the main one and uses the same user,
 * password and TLS settings (src/db/client.ts `poolConfig`); only the name differs
 * (DEMO_DB_NAME, default `vcfo_demo`). CREATE DATABASE cannot run inside the database it makes,
 * so the check and the create go through a connection to the main database.
 */
import path from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { poolConfig } from '../src/db/client';
import { demoDbName } from '../src/db/demo-scope';

export function requireDemoDbName(): string {
  const name = demoDbName();
  if (!name) throw new Error('DEMO_DB_NAME is switched off; there is no demo database to use.');
  const main = process.env.DB_SECRET_ARN ? process.env.DB_NAME : new URL(process.env.DATABASE_URL ?? 'postgres://x/').pathname.slice(1);
  if (main && main === name) throw new Error(`Refusing: DEMO_DB_NAME (${name}) is the main database.`);
  return name;
}

/** Describe a database target without its password. */
export function describeTarget(database?: string): string {
  if (process.env.DB_SECRET_ARN) return `RDS ${database ?? process.env.DB_NAME ?? ''} via ${process.env.DB_HOST}:${process.env.DB_PORT}`;
  const url = (process.env.DATABASE_URL ?? '').replace(/:\/\/[^@]*@/, '://***@');
  if (!url) return '(no database configured)';
  if (!database) return url;
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

/** A one-connection pool with the app's settings (a rotating RDS password is read per connection). */
function rawPool(database?: string): Pool {
  return new Pool({ ...poolConfig(database), max: 1 });
}

/** Create the demo database on the main server if it does not exist. */
export async function ensureDemoDatabase(): Promise<{ name: string; created: boolean }> {
  const name = requireDemoDbName();
  const pool = rawPool();
  try {
    const { rows } = await pool.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rows.length) {
      console.log(`Demo database "${name}" exists.`);
      return { name, created: false };
    }
    console.log(`Demo database "${name}" is missing: CREATE DATABASE through ${describeTarget()}…`);
    // The name is checked against [A-Za-z_][A-Za-z0-9_]* in demoDbName, so quoting is enough.
    // template0: a clean copy that does not inherit anything added to template1 on this server.
    await pool.query(`CREATE DATABASE "${name}" TEMPLATE template0`);
    console.log(`  created "${name}".`);
    return { name, created: true };
  } finally {
    await pool.end();
  }
}

/** Apply every migration in src/db/migrations to the demo database. */
export async function migrateDemoDatabase(): Promise<void> {
  const name = requireDemoDbName();
  const pool = rawPool(name);
  try {
    console.log(`Migrating ${describeTarget(name)}…`);
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), 'src/db/migrations') });
    const { rows } = await pool.query<{ n: string }>('SELECT count(*)::text AS n FROM drizzle.__drizzle_migrations');
    console.log(`  ${rows[0]?.n ?? '?'} migrations applied.`);
  } finally {
    await pool.end();
  }
}
