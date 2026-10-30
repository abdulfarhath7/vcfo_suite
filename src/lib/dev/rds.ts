import 'server-only';
import { RDSClient, CreateDBSnapshotCommand, DescribeDBInstancesCommand, DescribeDBSnapshotsCommand } from '@aws-sdk/client-rds';
import type { RdsBackups, Reach } from './types';
import { missingEnv, notSetUp, reach } from './reach';

/**
 * RDS backups for Data and costs (P-365, P-372): the instance's backup settings and its
 * snapshots, and "Take snapshot now". There is no restore from the console: a restore
 * makes a new instance and follows the runbook in docs/context/AWS-DEPLOY.md.
 *
 * Env: RDS_INSTANCE_ID (the identifier, not the ARN), AWS_REGION.
 * IAM: rds:DescribeDBInstances, rds:DescribeDBSnapshots, rds:CreateDBSnapshot and
 * rds:AddTagsToResource on the instance and its snapshots.
 */

const HANDLER = { requestTimeout: 5000, connectionTimeout: 2000 };

function client(): RDSClient {
  return new RDSClient({ region: process.env.AWS_REGION?.trim() || process.env.S3_REGION?.trim() || 'ap-south-1', maxAttempts: 1, requestHandler: HANDLER });
}

export async function readRdsBackups(): Promise<Reach<RdsBackups>> {
  const missing = missingEnv(['RDS_INSTANCE_ID']);
  if (missing.length) return notSetUp(missing);
  const id = process.env.RDS_INSTANCE_ID!.trim();
  return reach(async (abortSignal) => {
    const c = client();
    const [inst, snaps] = await Promise.all([
      c.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: id }), { abortSignal }),
      c.send(new DescribeDBSnapshotsCommand({ DBInstanceIdentifier: id, MaxRecords: 100 }), { abortSignal }),
    ]);
    const i = inst.DBInstances?.[0];
    if (!i) throw new Error('Instance not found');
    return {
      instance: i.DBInstanceIdentifier ?? id,
      engine: `${i.Engine ?? ''} ${i.EngineVersion ?? ''}`.trim(),
      instanceClass: i.DBInstanceClass ?? null,
      multiAz: i.MultiAZ ?? null,
      retentionDays: i.BackupRetentionPeriod ?? null,
      backupWindow: i.PreferredBackupWindow ?? null,
      latestRestorable: i.LatestRestorableTime ? new Date(i.LatestRestorableTime).toISOString() : null,
      snapshots: (snaps.DBSnapshots ?? [])
        .map((s) => ({
          id: s.DBSnapshotIdentifier ?? '',
          takenAt: s.SnapshotCreateTime ? new Date(s.SnapshotCreateTime).toISOString() : null,
          kind: s.SnapshotType ?? 'manual',
          sizeGiB: s.AllocatedStorage ?? null,
          status: s.Status ?? 'unknown',
        }))
        .sort((a, b) => (b.takenAt ?? '').localeCompare(a.takenAt ?? '')),
    };
  });
}

/** "vcfo-manual-20261030-0915" in UTC: RDS ids take letters, digits and hyphens. */
export function manualSnapshotId(instance: string, now = new Date()): string {
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return `${instance}-manual-${stamp}`.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 255);
}

/** "Take snapshot now": one manual snapshot of RDS_INSTANCE_ID. Returns its id. */
export async function takeRdsSnapshot(now = new Date()): Promise<{ id: string; status: string }> {
  const missing = missingEnv(['RDS_INSTANCE_ID']);
  if (missing.length) throw new Error('not_set_up');
  const instance = process.env.RDS_INSTANCE_ID!.trim();
  const id = manualSnapshotId(instance, now);
  const res = await client().send(
    new CreateDBSnapshotCommand({ DBInstanceIdentifier: instance, DBSnapshotIdentifier: id, Tags: [{ Key: 'made-by', Value: 'vcfo-dev-console' }] }),
  );
  return { id: res.DBSnapshot?.DBSnapshotIdentifier ?? id, status: res.DBSnapshot?.Status ?? 'creating' };
}
