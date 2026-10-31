// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * M7 SOC 2 readers with mocked AWS clients: real answers become rows, and an IAM refusal
 * becomes the honest "Not connected" state on each card.
 */

type Handler = (input: Record<string, unknown>) => unknown;
const handlers: Record<string, Handler> = {};

function denied(): never {
  throw Object.assign(new Error('User is not authorized to perform this action'), { name: 'AccessDeniedException' });
}

function sdk(names: string[]) {
  const mod: Record<string, unknown> = {};
  for (const n of names) {
    mod[n] = class {
      constructor(public input: Record<string, unknown>) {}
      static commandName = n;
    };
  }
  mod.Client = class {
    async send(cmd: { input: Record<string, unknown>; constructor: { commandName: string } }) {
      const h = handlers[cmd.constructor.commandName];
      if (!h) throw new Error(`no mock for ${cmd.constructor.commandName}`);
      return h(cmd.input);
    }
  };
  return mod;
}

vi.mock('@aws-sdk/client-secrets-manager', () => {
  const m = sdk(['DescribeSecretCommand']);
  return { ...m, SecretsManagerClient: m.Client };
});
vi.mock('@aws-sdk/client-backup', () => {
  const m = sdk(['GetBackupPlanCommand', 'ListRecoveryPointsByBackupVaultCommand']);
  return { ...m, BackupClient: m.Client };
});
vi.mock('@aws-sdk/client-ec2', () => {
  const m = sdk(['DescribeInstancesCommand', 'DescribeNatGatewaysCommand']);
  return { ...m, EC2Client: m.Client };
});
vi.mock('@aws-sdk/client-apprunner', () => {
  const m = sdk(['DescribeServiceCommand', 'DescribeVpcConnectorCommand']);
  return { ...m, AppRunnerClient: m.Client };
});
vi.mock('@aws-sdk/client-rds', () => {
  const m = sdk(['DescribeDBInstancesCommand']);
  return { ...m, RDSClient: m.Client };
});

const { readBackupPlan, readNetwork, readSecretRotation } = await import('./soc');

const NOW = new Date('2026-10-30T12:00:00Z');
const DB_ARN = 'arn:aws:secretsmanager:ap-south-1:600627321277:secret:rds!db-1234-AbCdEf';

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  vi.stubEnv('AWS_REGION', 'ap-south-1');
});
afterEach(() => vi.unstubAllEnvs());

describe('readSecretRotation', () => {
  it('lists each secret with its due date and RDS auto-rotation', async () => {
    vi.stubEnv('DB_SECRET_ARN', DB_ARN);
    vi.stubEnv('RDS_INSTANCE_ID', 'vcfo-suite-db');
    handlers.DescribeSecretCommand = ({ SecretId }) => {
      if (SecretId === DB_ARN) {
        return { Name: 'rds!db-1234', RotationEnabled: true, RotationRules: { AutomaticallyAfterDays: 7 }, LastRotatedDate: new Date('2026-10-28'), NextRotationDate: new Date('2026-11-04') };
      }
      if (SecretId === '/vcfo/ask-vcfo/anthropic-api-key') {
        throw Object.assign(new Error('Secrets Manager cannot find the secret'), { name: 'ResourceNotFoundException' });
      }
      return { Name: SecretId, LastChangedDate: new Date('2026-10-01'), CreatedDate: new Date('2026-01-01') };
    };
    handlers.DescribeDBInstancesCommand = () => ({ DBInstances: [{ MasterUserSecret: { SecretStatus: 'active' } }] });

    const out = await readSecretRotation(NOW);
    const by = Object.fromEntries(out.rows.map((r) => [r.key, r]));
    expect(by.auth).toMatchObject({ name: 'vcfo-suite/AUTH_SECRET', status: 'ok', finding: '371', dueAt: '2026-12-30T00:00:00.000Z' });
    expect(by.azure).toMatchObject({ status: 'ok', dueAt: '2027-04-01T00:00:00.000Z' });
    expect(by.anthropic.status).toBe('not_found');
    expect(by.db).toMatchObject({ status: 'auto', name: 'rds!db-1234' });
    expect(out.rdsAutoRotation).toEqual({ state: 'ok', data: { enabled: true, everyDays: 7, nextAt: '2026-11-04T00:00:00.000Z', status: 'active' } });
    expect(JSON.stringify(out)).not.toContain('600627321277');
  });

  it('says Not connected when the app role may not describe secrets', async () => {
    vi.stubEnv('DB_SECRET_ARN', DB_ARN);
    handlers.DescribeSecretCommand = denied;
    const out = await readSecretRotation(NOW);
    expect(out.rows.every((r) => r.status === 'not_connected')).toBe(true);
    expect(out.rdsAutoRotation.state).toBe('not_connected');
  });
});

describe('readBackupPlan', () => {
  it('is not set up without BACKUP_PLAN_ID', async () => {
    vi.stubEnv('BACKUP_PLAN_ID', '');
    expect(await readBackupPlan()).toEqual({ state: 'not_set_up', missing: ['BACKUP_PLAN_ID'] });
  });

  it('reads the plan and its recovery points, newest first', async () => {
    vi.stubEnv('BACKUP_PLAN_ID', 'plan-1');
    handlers.GetBackupPlanCommand = () => ({
      BackupPlan: { BackupPlanName: 'vcfo-suite-db', Rules: [{ TargetBackupVaultName: 'vcfo-suite-db', ScheduleExpression: 'cron(30 20 * * ? *)', Lifecycle: { DeleteAfterDays: 30 } }] },
    });
    handlers.ListRecoveryPointsByBackupVaultCommand = (input) => {
      expect(input).toMatchObject({ BackupVaultName: 'vcfo-suite-db', ByBackupPlanId: 'plan-1' });
      return {
        RecoveryPoints: [
          { RecoveryPointArn: 'arn:aws:rds:ap-south-1:6:snapshot:awsbackup:job-1', CreationDate: new Date('2026-10-28T20:30:00Z'), Status: 'COMPLETED', ResourceArn: 'arn:aws:rds:ap-south-1:6:db:vcfo-suite-db' },
          { RecoveryPointArn: 'arn:aws:rds:ap-south-1:6:snapshot:awsbackup:job-2', CreationDate: new Date('2026-10-29T20:30:00Z'), Status: 'COMPLETED' },
        ],
      };
    };
    const out = await readBackupPlan();
    expect(out.state).toBe('ok');
    if (out.state !== 'ok') return;
    expect(out.data).toMatchObject({ planName: 'vcfo-suite-db', scheduleLabel: '02:00 IST', deleteAfterDays: 30, vault: 'vcfo-suite-db' });
    expect(out.data.points.map((p) => p.id)).toEqual(['job-2', 'job-1']);
    expect(out.data.points[1]!.resource).toBe('vcfo-suite-db');
  });

  it('says Not connected on an IAM refusal', async () => {
    vi.stubEnv('BACKUP_PLAN_ID', 'plan-1');
    handlers.GetBackupPlanCommand = denied;
    expect((await readBackupPlan()).state).toBe('not_connected');
  });
});

describe('readNetwork', () => {
  it('shows the connector, the NAT instance and RDS private', async () => {
    vi.stubEnv('APP_RUNNER_SERVICE_ARN', 'arn:aws:apprunner:ap-south-1:6:service/vcfo-suite/abc');
    vi.stubEnv('RDS_INSTANCE_ID', 'vcfo-suite-db');
    handlers.DescribeServiceCommand = () => ({
      Service: { NetworkConfiguration: { EgressConfiguration: { EgressType: 'VPC', VpcConnectorArn: 'arn:aws:apprunner:ap-south-1:6:vpcconnector/vcfo-suite/1/x' } } },
    });
    handlers.DescribeVpcConnectorCommand = () => ({ VpcConnector: { VpcConnectorName: 'vcfo-suite', Status: 'ACTIVE', Subnets: ['a', 'b'], SecurityGroups: ['sg'] } });
    handlers.DescribeInstancesCommand = () => ({
      Reservations: [
        {
          Instances: [
            { InstanceId: 'i-nat', InstanceType: 't4g.nano', State: { Name: 'running' }, Tags: [{ Key: 'Name', Value: 'vcfo-suite-nat' }] },
            { InstanceId: 'i-other', State: { Name: 'running' }, Tags: [{ Key: 'Name', Value: 'bastion' }] },
          ],
        },
      ],
    });
    handlers.DescribeNatGatewaysCommand = () => ({ NatGateways: [] });
    handlers.DescribeDBInstancesCommand = () => ({ DBInstances: [{ DBInstanceIdentifier: 'vcfo-suite-db', PubliclyAccessible: false }] });

    const out = await readNetwork();
    expect(out.connector).toEqual({ state: 'ok', data: { name: 'vcfo-suite', status: 'ACTIVE', subnets: 2, securityGroups: 1 } });
    expect(out.nat).toEqual({ state: 'ok', data: [{ id: 'i-nat', name: 'vcfo-suite-nat', kind: 'instance', state: 'running', type: 't4g.nano' }] });
    expect(out.rds).toEqual({ state: 'ok', data: { instance: 'vcfo-suite-db', publiclyAccessible: false } });
  });

  it('degrades each part to Not connected on its own', async () => {
    vi.stubEnv('APP_RUNNER_VPC_CONNECTOR_ARN', 'arn:aws:apprunner:ap-south-1:6:vpcconnector/vcfo-suite/1/x');
    vi.stubEnv('DB_HOST', 'vcfo-suite-db.abc.ap-south-1.rds.amazonaws.com');
    handlers.DescribeVpcConnectorCommand = denied;
    handlers.DescribeInstancesCommand = () => {
      throw Object.assign(new Error('You are not authorized to perform this operation.'), { name: 'UnauthorizedOperation' });
    };
    handlers.DescribeNatGatewaysCommand = () => ({ NatGateways: [] });
    handlers.DescribeDBInstancesCommand = denied;
    const out = await readNetwork();
    expect(out.connector.state).toBe('not_connected');
    expect(out.nat.state).toBe('not_connected');
    expect(out.rds.state).toBe('not_connected');
  });
});
