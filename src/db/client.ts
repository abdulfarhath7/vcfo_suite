import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Single Postgres pool for the app.
 *
 * LOCAL:  connects to the Docker Postgres from docker-compose.yml
 * AWS:    set DATABASE_URL to your RDS endpoint (with ?sslmode=require).
 *
 * Nothing above the repository layer imports this. Components and domain
 * logic call repository functions in src/db/repositories/*, which are the
 * ONLY code allowed to touch the database. That is the seam that makes the
 * laptop -> AWS move a config change instead of a rewrite.
 */
const globalForDb = globalThis as unknown as { __vcfoPool?: Pool };

const pool =
  globalForDb.__vcfoPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    // RDS requires TLS; MinIO/local Postgres does not. Toggle via the URL.
    ssl:
      process.env.DATABASE_URL?.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__vcfoPool = pool;
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;
