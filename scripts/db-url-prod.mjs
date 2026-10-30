#!/usr/bin/env node
/**
 * Prints the production DATABASE_URL for laptop work (db:migrate, psql).
 *
 * Once infra/ runs with db_managed_password = true, RDS owns the master
 * password and rotates it every 7 days, so there is no DATABASE_URL secret to
 * copy any more. This script asks RDS which secret holds the password, reads
 * it with the AWS CLI (your own credentials, read-only calls) and prints a
 * postgresql URL with sslmode=require. The password is URL-encoded.
 *
 *   export DATABASE_URL="$(node scripts/db-url-prod.mjs)"
 *   NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem npm run db:migrate
 *
 * Options: --db <identifier> (default vcfo-suite-db), --region (default ap-south-1).
 * The URL holds a live password: do not paste it anywhere or save it to a file.
 */
import { execFileSync } from 'node:child_process';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dbId = arg('db', 'vcfo-suite-db');
const region = arg('region', process.env.AWS_REGION || 'ap-south-1');

function aws(args) {
  const out = execFileSync('aws', [...args, '--region', region, '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out);
}

const instance = aws(['rds', 'describe-db-instances', '--db-instance-identifier', dbId])
  .DBInstances?.[0];
if (!instance) throw new Error(`No RDS instance named ${dbId}`);

const secretArn = instance.MasterUserSecret?.SecretArn;
if (!secretArn) {
  console.error(
    `${dbId} does not use an RDS-managed password yet (db_managed_password is false). ` +
      'Read the vcfo-suite/DATABASE_URL secret instead.',
  );
  process.exit(1);
}

const secret = aws(['secretsmanager', 'get-secret-value', '--secret-id', secretArn]);
const { username, password } = JSON.parse(secret.SecretString ?? '{}');
if (!password) throw new Error('The master secret has no password field');

const user = encodeURIComponent(username ?? instance.MasterUsername);
const host = instance.Endpoint.Address;
const port = instance.Endpoint.Port;
const name = instance.DBName;
console.log(
  `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}?sslmode=require`,
);
