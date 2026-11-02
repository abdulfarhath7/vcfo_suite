import 'server-only';
import { DescribeSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { BackupClient, GetBackupPlanCommand, ListRecoveryPointsByBackupVaultCommand } from '@aws-sdk/client-backup';
import { DescribeInstancesCommand, DescribeNatGatewaysCommand, EC2Client, type Filter } from '@aws-sdk/client-ec2';
import { AppRunnerClient, DescribeServiceCommand, DescribeVpcConnectorCommand } from '@aws-sdk/client-apprunner';
import { DescribeDBInstancesCommand, RDSClient } from '@aws-sdk/client-rds';
import type { BackupPlanInfo, Linked, NetworkPayload, RotationPayload, RotationRow } from './types';
import { missingEnv, notSetUp, reach } from './reach';
import { ROTATION_SECRETS, dailyCronIst, isAccessDenied, rdsInstanceId, rotationErrorRow, rotationRow, secretIdFor, type SecretFacts } from './rotation';

/**
 * AWS readers for the SOC 2 cards in the developer console (M7). Every call is read-only,
 * one attempt, with a short timeout. When the app role has no IAM grant for a call, the
 * reader returns `not_connected` and the card says so; it never guesses a value.
 *
 * Env: AWS_REGION; BACKUP_PLAN_ID and BACKUP_VAULT_NAME (AWS Backup); RDS_INSTANCE_ID or
 * DB_HOST (RDS); APP_RUNNER_VPC_CONNECTOR_ARN or APP_RUNNER_SERVICE_ARN (the connector is
 * read from the service when its ARN is not given); NAT_INSTANCE_ID (else the NAT instance
 * is found by its project tag and a "nat" name); DB_SECRET_ARN and the `*_SECRET_ID` vars
 * (rotation).
 *
 * IAM (infra/soc-runtime.tf): secretsmanager:DescribeSecret on the vCFO secrets;
 * backup:GetBackupPlan on the plan; backup:ListRecoveryPointsByBackupVault on the vault;
 * ec2:DescribeInstances and ec2:DescribeNatGateways (EC2 has no resource scoping for these);
 * apprunner:DescribeVpcConnector on the vCFO connectors; rds:DescribeDBInstances on the DB.
 */

const HANDLER = { requestTimeout: 4000, connectionTimeout: 2000 };
const PROJECT = 'vcfo-suite';

function region(): string {
  return process.env.AWS_REGION?.trim() || process.env.S3_REGION?.trim() || 'ap-south-1';
}

const opts = (r: string = region()) => ({ region: r, maxAttempts: 1, requestHandler: HANDLER });
const iso = (d: Date | undefined | null) => (d ? new Date(d).toISOString() : null);

/** `reach`, with an IAM refusal turned into the honest "Not connected" state. */
async function linked<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs?: number): Promise<Linked<T>> {
  const r = await reach(fn, timeoutMs);
  if (r.state === 'unreachable' && isAccessDenied(r.error)) return { state: 'not_connected', error: r.error };
  return r;
}

// ---------- Secrets and rotation ----------

export async function readSecretRotation(now = new Date()): Promise<RotationPayload> {
  const client = new SecretsManagerClient(opts());
  const facts: Record<string, SecretFacts & { rotationDays?: number | null }> = {};

  const rows = await Promise.all(
    ROTATION_SECRETS.map(async (def): Promise<RotationRow> => {
      const id = secretIdFor(def);
      if (!id) return rotationErrorRow(def, def.idEnv, 'not_found', `${def.idEnv} is not set`);
      const r = await linked(async (abortSignal) => {
        const out = await client.send(new DescribeSecretCommand({ SecretId: id }), { abortSignal });
        return {
          name: out.Name ?? null,
          createdDate: out.CreatedDate ?? null,
          lastChangedDate: out.LastChangedDate ?? null,
          lastRotatedDate: out.LastRotatedDate ?? null,
          nextRotationDate: out.NextRotationDate ?? null,
          rotationEnabled: out.RotationEnabled ?? false,
          rotationDays: out.RotationRules?.AutomaticallyAfterDays ?? null,
        };
      });
      if (r.state === 'ok') {
        facts[def.key] = r.data;
        return rotationRow(def, r.data, now);
      }
      // Never show an ARN: its account and suffix are not needed on the page.
      const shown = id.startsWith('arn:') ? (id.split(':secret:')[1] ?? def.key).replace(/-[A-Za-z0-9]{6}$/, '') : id;
      if (r.state === 'not_connected') return rotationErrorRow(def, shown, 'not_connected');
      if (r.state === 'unreachable' && /ResourceNotFound/i.test(r.error)) return rotationErrorRow(def, shown, 'not_found');
      return rotationErrorRow(def, shown, 'unreachable', r.state === 'unreachable' ? r.error : undefined);
    }),
  );

  const dbArn = process.env.DB_SECRET_ARN?.trim();
  let rdsAutoRotation: RotationPayload['rdsAutoRotation'];
  const db = facts.db;
  const dbRow = rows.find((x) => x.key === 'db');
  if (!dbArn) rdsAutoRotation = notSetUp(['DB_SECRET_ARN']);
  else if (db) {
    const instance = rdsInstanceId();
    const status = instance
      ? await linked(async (abortSignal) => {
          const out = await new RDSClient(opts()).send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: instance }), { abortSignal });
          return out.DBInstances?.[0]?.MasterUserSecret?.SecretStatus ?? null;
        })
      : null;
    rdsAutoRotation = {
      state: 'ok',
      data: {
        enabled: Boolean(db.rotationEnabled),
        everyDays: db.rotationDays ?? null,
        nextAt: iso(db.nextRotationDate),
        status: status?.state === 'ok' ? status.data : null,
      },
    };
  } else if (dbRow?.status === 'not_connected') rdsAutoRotation = { state: 'not_connected', error: 'secretsmanager:DescribeSecret' };
  else rdsAutoRotation = { state: 'unreachable', error: dbRow?.error ?? 'The database secret did not answer' };

  return { rows, rdsAutoRotation };
}

// ---------- AWS Backup ----------

export async function readBackupPlan(): Promise<Linked<BackupPlanInfo>> {
  const missing = missingEnv(['BACKUP_PLAN_ID']);
  if (missing.length) return notSetUp(missing);
  const planId = process.env.BACKUP_PLAN_ID!.trim();
  const vaultEnv = process.env.BACKUP_VAULT_NAME?.trim() || null;
  return linked(async (abortSignal) => {
    const client = new BackupClient(opts());
    const plan = await client.send(new GetBackupPlanCommand({ BackupPlanId: planId }), { abortSignal });
    const rule = plan.BackupPlan?.Rules?.[0];
    const vault = vaultEnv ?? rule?.TargetBackupVaultName ?? null;
    const points = vault
      ? await client.send(new ListRecoveryPointsByBackupVaultCommand({ BackupVaultName: vault, ByBackupPlanId: planId, MaxResults: 40 }), { abortSignal })
      : null;
    return {
      planName: plan.BackupPlan?.BackupPlanName ?? planId,
      vault,
      schedule: rule?.ScheduleExpression ?? null,
      scheduleLabel: dailyCronIst(rule?.ScheduleExpression),
      deleteAfterDays: rule?.Lifecycle?.DeleteAfterDays ?? null,
      points: (points?.RecoveryPoints ?? [])
        .map((p, i) => ({
          id: (p.RecoveryPointArn ?? `point-${i}`).split(':').pop() ?? `point-${i}`,
          createdAt: iso(p.CreationDate),
          status: p.Status ?? 'UNKNOWN',
          sizeBytes: p.BackupSizeInBytes ?? null,
          deleteAt: iso(p.CalculatedLifecycle?.DeleteAt),
          resource: p.ResourceArn ? (p.ResourceArn.split(':').pop() ?? null) : (p.ResourceType ?? null),
        }))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    };
  });
}

// ---------- Network ----------

async function readConnector(): Promise<NetworkPayload['connector']> {
  const given = process.env.APP_RUNNER_VPC_CONNECTOR_ARN?.trim();
  const service = process.env.APP_RUNNER_SERVICE_ARN?.trim();
  if (!given && !service) return notSetUp(['APP_RUNNER_VPC_CONNECTOR_ARN']);
  return linked(async (abortSignal) => {
    const r = (given ?? service)!.split(':')[3] || region();
    const client = new AppRunnerClient(opts(r));
    let arn = given;
    if (!arn) {
      const svc = await client.send(new DescribeServiceCommand({ ServiceArn: service }), { abortSignal });
      const egress = svc.Service?.NetworkConfiguration?.EgressConfiguration;
      if (egress?.EgressType !== 'VPC' || !egress.VpcConnectorArn) throw new Error('The service has no VPC connector');
      arn = egress.VpcConnectorArn;
    }
    const out = await client.send(new DescribeVpcConnectorCommand({ VpcConnectorArn: arn }), { abortSignal });
    const c = out.VpcConnector;
    return {
      name: c?.VpcConnectorName ?? arn.split('/')[1] ?? 'connector',
      status: c?.Status ?? 'UNKNOWN',
      subnets: c?.Subnets?.length ?? 0,
      securityGroups: c?.SecurityGroups?.length ?? 0,
    };
  });
}

async function readNat(): Promise<NetworkPayload['nat']> {
  return linked(async (abortSignal) => {
    const client = new EC2Client(opts());
    const id = process.env.NAT_INSTANCE_ID?.trim();
    const tagged: Filter[] = [{ Name: 'tag:project', Values: [PROJECT] }];
    const [inst, gws] = await Promise.all([
      client.send(
        new DescribeInstancesCommand(
          id ? { InstanceIds: [id] } : { Filters: [...tagged, { Name: 'instance-state-name', Values: ['pending', 'running', 'stopping', 'stopped'] }] },
        ),
        { abortSignal },
      ),
      client.send(new DescribeNatGatewaysCommand({ Filter: tagged, MaxResults: 10 }), { abortSignal }),
    ]);
    const nameOf = (tags: { Key?: string; Value?: string }[] | undefined) => tags?.find((t) => t.Key === 'Name')?.Value ?? null;
    const instances = (inst.Reservations ?? [])
      .flatMap((r) => r.Instances ?? [])
      .filter((i) => id || /nat/i.test(`${nameOf(i.Tags) ?? ''} ${i.IamInstanceProfile?.Arn ?? ''}`))
      .map((i) => ({
        id: i.InstanceId ?? '',
        name: nameOf(i.Tags),
        kind: 'instance' as const,
        state: i.State?.Name ?? 'unknown',
        type: i.InstanceType ?? null,
      }));
    const gateways = (gws.NatGateways ?? [])
      .filter((g) => g.State !== 'deleted')
      .map((g) => ({ id: g.NatGatewayId ?? '', name: nameOf(g.Tags), kind: 'gateway' as const, state: g.State ?? 'unknown', type: null }));
    return [...instances, ...gateways];
  });
}

async function readRdsPrivate(): Promise<NetworkPayload['rds']> {
  const instance = rdsInstanceId();
  if (!instance) return notSetUp(['RDS_INSTANCE_ID']);
  return linked(async (abortSignal) => {
    const out = await new RDSClient(opts()).send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: instance }), { abortSignal });
    const i = out.DBInstances?.[0];
    if (!i) throw new Error('Instance not found');
    return { instance: i.DBInstanceIdentifier ?? instance, publiclyAccessible: Boolean(i.PubliclyAccessible) };
  });
}

export async function readNetwork(): Promise<NetworkPayload> {
  const [connector, nat, rds] = await Promise.all([readConnector(), readNat(), readRdsPrivate()]);
  return { connector, nat, rds };
}
