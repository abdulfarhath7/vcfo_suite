/**
 * Connection settings for the plain `pg` scripts (backfills), M7.
 *
 * - LOCAL: DATABASE_URL (the Docker Postgres). Local dev only. DB_SECRET_ARN wins when both are set.
 * - PRODUCTION: RDS is private and there is no DATABASE_URL. Open the SSM port forward on
 *   the NAT instance first (`node scripts/db-env-prod.mjs` prints the command and the
 *   exports), then set DB_SECRET_ARN, DB_HOST=127.0.0.1, DB_PORT, DB_NAME, DB_USER and
 *   DB_SSL_SERVERNAME. The password is read from the RDS-managed secret with the AWS CLI
 *   and your own credentials; it is never printed. Never open RDS to the internet.
 */
import { execFileSync } from 'node:child_process';

export function pgConfig() {
  const secretArn = process.env.DB_SECRET_ARN?.trim();
  if (secretArn) {
    const region = secretArn.split(':')[3] || process.env.AWS_REGION || 'ap-south-1';
    const out = execFileSync(
      'aws',
      ['secretsmanager', 'get-secret-value', '--secret-id', secretArn, '--region', region, '--query', 'SecretString', '--output', 'text'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const { password } = JSON.parse(out);
    if (!password) throw new Error('The RDS master secret has no password field');
    const servername = process.env.DB_SSL_SERVERNAME?.trim();
    return {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'vcfo',
      user: process.env.DB_USER ?? 'vcfo',
      password,
      ssl: servername ? { servername } : true,
    };
  }
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL (local) or DB_SECRET_ARN and the DB_* vars (RDS through the SSM tunnel)');
  return { connectionString: process.env.DATABASE_URL };
}
