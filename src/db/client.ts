import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * Single Postgres pool for the app.
 *
 * LOCAL:  connects to the Docker Postgres from docker-compose.yml
 * AWS:    set DATABASE_URL to your RDS endpoint (with ?sslmode=require).
 *         `pg` verifies the server certificate chain for that mode, and RDS
 *         chains to Amazon's own CA, so the process must trust
 *         certs/rds-global-bundle.pem via NODE_EXTRA_CA_CERTS (Dockerfile).
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
    // TLS on/off comes from the URL's sslmode (RDS: require; local: none).
    // No `ssl: { rejectUnauthorized: false }` — that would silently accept
    // any certificate on a public endpoint. Trust the RDS CA bundle instead.
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__vcfoPool = pool;
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;
