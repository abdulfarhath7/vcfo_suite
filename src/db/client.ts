import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getDbPassword, invalidateDbPassword } from './db-password';

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

/**
 * AWS with a rotating password: DB_SECRET_ARN names the RDS-managed master
 * secret and DB_HOST / DB_PORT / DB_NAME / DB_USER describe the instance. The
 * password is read per new connection (db-password.ts), so a rotation needs
 * no redeploy. Without DB_SECRET_ARN (local, or before the switch) the pool
 * uses DATABASE_URL exactly as before.
 */
class RotatingPasswordPool extends Pool {
  // A login failure means the cached password is stale: drop it so the next
  // connection reads the rotated value.
  connect(...args: any[]): any {
    const cb = args[0];
    if (typeof cb === 'function') {
      return super.connect((err, client, done) => {
        if ((err as { code?: string } | undefined)?.code === '28P01') invalidateDbPassword();
        cb(err, client, done);
      });
    }
    return super.connect().catch((err: { code?: string }) => {
      if (err?.code === '28P01') invalidateDbPassword();
      throw err;
    });
  }
}

function createPool(): Pool {
  const secretArn = process.env.DB_SECRET_ARN;
  if (secretArn) {
    return new RotatingPasswordPool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: () => getDbPassword(secretArn),
      // Verified TLS, the same as sslmode=require with the RDS CA bundle.
      ssl: true,
    });
  }
  return new Pool({
    // TLS on/off comes from the URL's sslmode (RDS: require; local: none).
    // No `ssl: { rejectUnauthorized: false }` — that would silently accept
    // any certificate on a public endpoint. Trust the RDS CA bundle instead.
    connectionString: process.env.DATABASE_URL,
  });
}

const pool = globalForDb.__vcfoPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__vcfoPool = pool;
}

export const db = drizzle(pool, { schema });
