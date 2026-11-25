import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { getDbPassword, invalidateDbPassword } from './db-password';
import { DemoScopeUnavailableError, demoDbName, isDemoScope } from './demo-scope';

/**
 * Single Postgres pool for the app.
 *
 * LOCAL:  DATABASE_URL, the Docker Postgres from docker-compose.yml. Local
 *         dev only: production never has a DATABASE_URL.
 * AWS:    DB_SECRET_ARN + DB_HOST / DB_PORT / DB_NAME / DB_USER (below). RDS is
 *         private, reached through the App Runner VPC connector. TLS is
 *         verified, and RDS chains to Amazon's own CA, so the process must trust
 *         certs/rds-global-bundle.pem via NODE_EXTRA_CA_CERTS (Dockerfile).
 * TUNNEL: a one-off script from a laptop reaches RDS only through the SSM port
 *         forward on the NAT instance (docs/context/AWS-DEPLOY.md). Then DB_HOST
 *         is 127.0.0.1 and DB_SSL_SERVERNAME is the RDS endpoint, so the
 *         certificate is still checked against the real RDS name.
 *
 * DEMO LOGINS (PLAN H2): `db` sends each query to the main database or, inside a demo scope, to
 *         the demo database (DEMO_DB_NAME) on the same server. See src/db/demo-scope.ts.
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
 * no redeploy. Without DB_SECRET_ARN (local dev) the pool uses DATABASE_URL.
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

/** Connection settings of the main database or, with `database`, another one on the same server. */
export function poolConfig(database?: string): ConstructorParameters<typeof Pool>[0] {
  const secretArn = process.env.DB_SECRET_ARN;
  if (secretArn) {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 5432),
      database: database ?? process.env.DB_NAME,
      user: process.env.DB_USER,
      password: () => getDbPassword(secretArn),
      // Verified TLS, the same as sslmode=require with the RDS CA bundle. Through
      // the SSM tunnel the certificate is checked against DB_SSL_SERVERNAME.
      ssl: process.env.DB_SSL_SERVERNAME?.trim() ? { servername: process.env.DB_SSL_SERVERNAME.trim() } : true,
    };
  }
  // TLS on/off comes from the URL's sslmode (RDS: require; local: none).
  // No `ssl: { rejectUnauthorized: false }` — that would silently accept
  // any certificate on a public endpoint. Trust the RDS CA bundle instead.
  return { connectionString: database ? withDatabase(process.env.DATABASE_URL ?? '', database) : process.env.DATABASE_URL };
}

/** DATABASE_URL with another database name in its path. */
export function withDatabase(url: string, database: string): string {
  if (!url) return url;
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

function createPool(database?: string): Pool {
  const config = poolConfig(database);
  return process.env.DB_SECRET_ARN ? new RotatingPasswordPool(config) : new Pool(config);
}

const pool = globalForDb.__vcfoPool ?? createPool();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__vcfoPool = pool;
}

/**
 * The demo database pool (PLAN H2): the same server, user, password and TLS as the main pool,
 * with the database named by DEMO_DB_NAME (default `vcfo_demo`). Made on first use, so a process
 * that never serves a demo login never opens it. Kept on `globalThis` like the main pool.
 */
const globalForDemo = globalThis as unknown as { __vcfoDemoPool?: Pool; __vcfoDemoPoolName?: string };

function demoPool(): Pool {
  const name = demoDbName();
  if (!name) throw new DemoScopeUnavailableError();
  if (!globalForDemo.__vcfoDemoPool || globalForDemo.__vcfoDemoPoolName !== name) {
    globalForDemo.__vcfoDemoPool = createPool(name);
    globalForDemo.__vcfoDemoPoolName = name;
  }
  return globalForDemo.__vcfoDemoPool;
}

/** The pool the current call must use: the demo pool inside a demo scope, else the main pool. */
export async function currentPool(): Promise<Pool> {
  return (await isDemoScope()) ? demoPool() : pool;
}

/**
 * The pool drizzle talks to. It is a `Pool` (drizzle checks `instanceof Pool` to decide that a
 * transaction needs its own connection) that owns no connections: every query and every
 * `connect()` is handed to the main or the demo pool, chosen per call by `isDemoScope()`
 * (src/db/demo-scope.ts). A transaction takes one connection from one pool and keeps it to the
 * end, so it never mixes the two databases.
 */
class ScopedPool extends Pool {
  constructor() {
    super({ max: 1 });
  }

  query(...args: any[]): any {
    const last = args[args.length - 1];
    if (typeof last === 'function') {
      currentPool().then(
        (p) => (p.query as (...a: any[]) => unknown)(...args),
        (err) => last(err),
      );
      return undefined;
    }
    return currentPool().then((p) => (p.query as (...a: any[]) => Promise<unknown>)(...args));
  }

  connect(...args: any[]): any {
    const cb = args[0];
    if (typeof cb === 'function') {
      currentPool().then(
        (p) => p.connect(cb),
        (err) => cb(err, undefined, () => undefined),
      );
      return undefined;
    }
    return currentPool().then((p) => p.connect());
  }
}

/** The main pool, for code that must never follow the demo scope (none today). */
export const mainPool = pool;

export const db = drizzle(new ScopedPool(), { schema });
