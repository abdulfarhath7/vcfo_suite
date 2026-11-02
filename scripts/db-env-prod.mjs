#!/usr/bin/env node
/**
 * Prints what a laptop needs to reach the private production database (M7). It replaces
 * scripts/db-url-prod.mjs: production has no DATABASE_URL, RDS is not public, and a
 * migration or one-off script must run from inside the VPC, never by opening RDS.
 *
 * It asks AWS (your own credentials, read-only calls) for the RDS endpoint, its managed
 * master secret and the NAT instance, and prints:
 *   1. the SSM port-forward command through the NAT instance (run it in its own terminal),
 *   2. the env exports for src/db/client.ts, drizzle.config.ts and scripts/db-connect.mjs.
 * It prints NO password: each tool reads the rotating secret itself when it connects.
 *
 *   node scripts/db-env-prod.mjs                 # then paste the exports
 *   npm run db:migrate                           # through the tunnel
 *
 * Options: --db <identifier> (default vcfo-suite-db), --region (default ap-south-1),
 * --port <local port> (default 15432), --nat <instance id> (default: found by tag).
 */
import { execFileSync } from 'node:child_process';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const dbId = arg('db', 'vcfo-suite-db');
const region = arg('region', process.env.AWS_REGION || 'ap-south-1');
const localPort = arg('port', '15432');

function aws(args) {
  const out = execFileSync('aws', [...args, '--region', region, '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(out);
}

const instance = aws(['rds', 'describe-db-instances', '--db-instance-identifier', dbId]).DBInstances?.[0];
if (!instance) throw new Error(`No RDS instance named ${dbId}`);
const secretArn = instance.MasterUserSecret?.SecretArn;
if (!secretArn) throw new Error(`${dbId} does not use an RDS-managed password (db_managed_password is off)`);
if (instance.PubliclyAccessible) console.error(`WARNING: ${dbId} is publicly accessible. It should be private.`);

let nat = arg('nat', '');
if (!nat) {
  const res = aws([
    'ec2',
    'describe-instances',
    '--filters',
    'Name=tag:project,Values=vcfo-suite',
    'Name=instance-state-name,Values=running',
  ]);
  const found = (res.Reservations ?? [])
    .flatMap((r) => r.Instances ?? [])
    .find((i) => /nat/i.test(`${(i.Tags ?? []).find((t) => t.Key === 'Name')?.Value ?? ''} ${i.IamInstanceProfile?.Arn ?? ''}`));
  nat = found?.InstanceId ?? '<nat-instance-id>';
}

const host = instance.Endpoint.Address;
const port = instance.Endpoint.Port;

console.log(`# 1. In its own terminal (needs the Session Manager plugin):
aws ssm start-session --region ${region} --target ${nat} \\
  --document-name AWS-StartPortForwardingSessionToRemoteHost \\
  --parameters '{"host":["${host}"],"portNumber":["${port}"],"localPortNumber":["${localPort}"]}'

# 2. In the terminal that runs the migration or script:
export DB_SECRET_ARN='${secretArn}'
export DB_HOST=127.0.0.1
export DB_PORT=${localPort}
export DB_NAME='${instance.DBName}'
export DB_USER='${instance.MasterUsername}'
export DB_SSL_SERVERNAME='${host}'
export NODE_EXTRA_CA_CERTS=certs/rds-global-bundle.pem
export AWS_REGION=${region}`);
