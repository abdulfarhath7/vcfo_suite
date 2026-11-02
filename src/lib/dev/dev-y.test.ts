import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Round Y libraries: RDS backups (SDK mocked), the export logger (S3 and the row mocked). */

const sent: Array<{ name: string; input: Record<string, unknown> }> = [];
let answers: Record<string, unknown> = {};
const fake = (name: string) =>
  class {
    name = name;
    constructor(public input: Record<string, unknown>) {}
  };

vi.mock('@aws-sdk/client-rds', () => ({
  RDSClient: class {
    send = async (cmd: { name: string; input: Record<string, unknown> }) => {
      sent.push({ name: cmd.name, input: cmd.input });
      return answers[cmd.name] ?? {};
    };
  },
  CreateDBSnapshotCommand: fake('CreateDBSnapshotCommand'),
  DescribeDBInstancesCommand: fake('DescribeDBInstancesCommand'),
  DescribeDBSnapshotsCommand: fake('DescribeDBSnapshotsCommand'),
}));

const puts: string[] = [];
const rows: Array<Record<string, unknown>> = [];
let putFails = false;
vi.mock('@/storage/s3', () => ({
  putObject: async (key: string) => {
    if (putFails) throw new Error('down');
    puts.push(key);
  },
}));
vi.mock('@/db/repositories/export-files', () => ({
  recordExportFileForUser: async (_ctx: unknown, row: Record<string, unknown>) => {
    rows.push(row);
  },
}));

const rds = await import('./rds');
const exp = await import('@/lib/exports/record-export');
const ctx = { userId: 'u1', email: 'a@x.in', name: 'A', role: 'admin' as const };

beforeEach(() => {
  sent.length = 0;
  answers = {};
  puts.length = 0;
  rows.length = 0;
  putFails = false;
  delete process.env.RDS_INSTANCE_ID;
});

describe('rds backups', () => {
  it('is not set up without RDS_INSTANCE_ID, and makes no call', async () => {
    expect(await rds.readRdsBackups()).toEqual({ state: 'not_set_up', missing: ['RDS_INSTANCE_ID'] });
    await expect(rds.takeRdsSnapshot()).rejects.toThrow('not_set_up');
    expect(sent).toHaveLength(0);
  });

  it('lists snapshots newest first with kind, size and status', async () => {
    process.env.RDS_INSTANCE_ID = 'vcfo-db';
    answers.DescribeDBInstancesCommand = { DBInstances: [{ DBInstanceIdentifier: 'vcfo-db', Engine: 'postgres', EngineVersion: '16.4', BackupRetentionPeriod: 7, PreferredBackupWindow: '20:30-21:00' }] };
    answers.DescribeDBSnapshotsCommand = {
      DBSnapshots: [
        { DBSnapshotIdentifier: 'rds:vcfo-db-2026-10-28', SnapshotCreateTime: new Date('2026-10-28T21:00:00Z'), SnapshotType: 'automated', AllocatedStorage: 20, Status: 'available' },
        { DBSnapshotIdentifier: 'vcfo-db-manual-1', SnapshotCreateTime: new Date('2026-10-29T09:00:00Z'), SnapshotType: 'manual', AllocatedStorage: 20, Status: 'creating' },
      ],
    };
    const out = await rds.readRdsBackups();
    expect(out.state).toBe('ok');
    if (out.state !== 'ok') return;
    expect(out.data).toMatchObject({ instance: 'vcfo-db', engine: 'postgres 16.4', retentionDays: 7 });
    expect(out.data.snapshots.map((s) => s.id)).toEqual(['vcfo-db-manual-1', 'rds:vcfo-db-2026-10-28']);
  });

  it('takes a manual snapshot with a dated id', async () => {
    process.env.RDS_INSTANCE_ID = 'vcfo-db';
    answers.CreateDBSnapshotCommand = { DBSnapshot: { DBSnapshotIdentifier: 'vcfo-db-manual-20261030-0915', Status: 'creating' } };
    expect(rds.manualSnapshotId('vcfo-db', new Date('2026-10-30T09:15:00Z'))).toBe('vcfo-db-manual-20261030-0915');
    expect(await rds.takeRdsSnapshot(new Date('2026-10-30T09:15:00Z'))).toEqual({ id: 'vcfo-db-manual-20261030-0915', status: 'creating' });
    expect(sent[0].input).toMatchObject({ DBInstanceIdentifier: 'vcfo-db', DBSnapshotIdentifier: 'vcfo-db-manual-20261030-0915' });
  });
});

describe('export logger', () => {
  it('keeps a copy under exports/ and logs the size', async () => {
    await exp.recordExport(ctx, { kind: 'audit_log', format: 'csv', fileName: 'audit log.csv', body: 'a,b\n' });
    expect(puts[0]).toMatch(/^exports\/\d{4}-\d{2}\/.+-audit_log\.csv$/);
    expect(rows[0]).toMatchObject({ kind: 'audit_log', sizeBytes: 4, objectKey: puts[0] });
  });

  it('still logs, without a copy, when the upload fails, and never throws', async () => {
    putFails = true;
    await exp.recordExport(ctx, { kind: 'partner_report', format: 'pdf', fileName: 'r.pdf', body: new Uint8Array(3) });
    expect(rows[0]).toMatchObject({ objectKey: null, sizeBytes: 3 });
  });

  it('passes a streamed ZIP through unchanged and logs it when it ends', async () => {
    const src = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1, 2]));
        c.enqueue(new Uint8Array([3]));
        c.close();
      },
    });
    const out = exp.recordStreamExport(ctx, { kind: 'vault_zip', format: 'zip', fileName: 'v.zip' }, src);
    const got = new Uint8Array(await new Response(out).arrayBuffer());
    expect([...got]).toEqual([1, 2, 3]);
    await new Promise((r) => setTimeout(r, 0));
    expect(rows[0]).toMatchObject({ kind: 'vault_zip', sizeBytes: 3 });
    expect(puts).toHaveLength(1);
  });
});
