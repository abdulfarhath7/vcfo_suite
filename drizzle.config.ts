import { execFileSync } from 'node:child_process';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit is a standalone CLI — unlike `next dev`, it does NOT read
 * .env.local automatically, so DATABASE_URL would be undefined without this.
 *
 * process.loadEnvFile is built into Node 18.20+/20.6+/22 — no dotenv needed.
 * Existing environment variables win, so `DATABASE_URL=... npm run db:migrate`
 * keeps working. The try/catch is for the case with no file on disk.
 *
 * TWO PATHS (M7):
 * - LOCAL: DATABASE_URL (the Docker Postgres). Local dev only. DB_SECRET_ARN wins when both are set.
 * - PRODUCTION: there is no DATABASE_URL. RDS is private, so a migration runs from
 *   inside the VPC: open the SSM port forward on the NAT instance first
 *   (docs/context/AWS-DEPLOY.md), then set DB_SECRET_ARN, DB_HOST=127.0.0.1,
 *   DB_PORT (the local tunnel port), DB_NAME, DB_USER and DB_SSL_SERVERNAME (the RDS
 *   endpoint). The password is read from the RDS-managed secret with the AWS CLI and
 *   your own credentials at that moment; it is never printed or stored. Never open
 *   RDS to the internet for a migration.
 */
for (const file of ['.env.local', '.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file — fall through to the real environment.
  }
}

function rdsPassword(secretArn: string): string {
  const region = secretArn.split(':')[3] || process.env.AWS_REGION || 'ap-south-1';
  const out = execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', secretArn, '--region', region, '--query', 'SecretString', '--output', 'text'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const { password } = JSON.parse(out) as { password?: string };
  if (!password) throw new Error('The RDS master secret has no password field');
  return password;
}

function credentials() {
  const secretArn = process.env.DB_SECRET_ARN?.trim();
  if (secretArn) {
    const servername = process.env.DB_SSL_SERVERNAME?.trim();
    return {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'vcfo',
      user: process.env.DB_USER ?? 'vcfo',
      password: rdsPassword(secretArn),
      // Verified TLS; through the tunnel the certificate is checked against the RDS name.
      ssl: servername ? { servername } : true,
    };
  }
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local (see CLAUDE.md ' +
        'Setup), or, for RDS, set DB_SECRET_ARN and the DB_* vars (docs/context/AWS-DEPLOY.md).',
    );
  }
  return { url: process.env.DATABASE_URL };
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: credentials(),
  verbose: true,
  strict: true,
});
