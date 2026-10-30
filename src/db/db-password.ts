import 'server-only';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/**
 * Current database password from the RDS-managed master secret (DB_SECRET_ARN).
 *
 * RDS rotates that secret on its own schedule, so the password is never baked
 * into the environment. `pg` calls this for every NEW connection; open
 * connections stay logged in through a rotation. The value is cached for five
 * minutes, and client.ts drops the cache at once when Postgres answers 28P01
 * (bad password), so the next connection reads the rotated value.
 */
const CACHE_MS = 5 * 60 * 1000;

let client: SecretsManagerClient | undefined;
let cached: { password: string; at: number } | undefined;

export function invalidateDbPassword(): void {
  cached = undefined;
}

export async function getDbPassword(secretArn: string): Promise<string> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.password;
  // The region comes from the ARN, so nothing depends on AWS_REGION being set.
  client ??= new SecretsManagerClient({ region: secretArn.split(':')[3] || undefined });
  const out = await client.send(new GetSecretValueCommand({ SecretId: secretArn }));
  // RDS-managed secrets hold JSON: {"username": "...", "password": "..."}.
  const { password } = JSON.parse(out.SecretString ?? '{}') as { password?: string };
  if (!password) throw new Error('DB secret has no password field');
  cached = { password, at: Date.now() };
  return password;
}
