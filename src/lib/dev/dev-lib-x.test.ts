import { describe, expect, it } from 'vitest';
import { healthByService, incidentsFrom, p95, uptimeLow } from './health';
import { mailDomain, serviceMeta, tail4 } from './service-meta';
import { readServiceConfig } from './env-status';
import { secretInventory, serviceAccounts } from './secrets';
import { featureFlags } from './flags';
import { commitOf } from './format';
import { describeFunctions, runNowEvent } from './parse';
import type { DeployService, ServiceCheck } from './types';

/** Round X of the developer console: health from stored checks, service facts, secrets, flags. */

const check = (service: string, at: string, ok: boolean, ms = 100, id = `${service}-${at}`): ServiceCheck => ({
  id,
  service,
  ok,
  latencyMs: ms,
  detail: ok ? 'fine' : 'no answer',
  checkedAt: at,
  by: null,
});

describe('health', () => {
  it('works out p95 by nearest rank', () => {
    expect(p95([])).toBeNull();
    expect(p95([40])).toBe(40);
    expect(p95(Array.from({ length: 20 }, (_, i) => i + 1))).toBe(19);
  });

  it('gives uptime, p95 and the newest check per service, and nulls without checks', () => {
    const checks = [check('email', '2026-10-01T00:00:00Z', true, 100), check('email', '2026-10-02T00:00:00Z', false, 300), check('jobs', '2026-10-01T00:00:00Z', true, 50)];
    const [email, jobs, storage] = healthByService(['email', 'jobs', 'storage'], checks);
    expect(email).toMatchObject({ checks: 2, uptime: 50, p95: 300 });
    expect(email.lastCheck?.checkedAt).toBe('2026-10-02T00:00:00Z');
    expect(jobs).toMatchObject({ checks: 1, uptime: 100, p95: 50 });
    expect(storage).toMatchObject({ checks: 0, uptime: null, p95: null, lastCheck: null });
  });

  it('marks uptime below 99.5 as low', () => {
    expect(uptimeLow(99.4)).toBe(true);
    expect(uptimeLow(99.5)).toBe(false);
    expect(uptimeLow(null)).toBe(false);
  });

  it('makes one incident per run of failures, closed by the next pass, newest first', () => {
    const checks = [
      check('email', '2026-10-01T00:00:00Z', true),
      check('email', '2026-10-02T00:00:00Z', false),
      check('email', '2026-10-02T01:00:00Z', false),
      check('email', '2026-10-02T02:00:00Z', true),
      check('jobs', '2026-10-03T00:00:00Z', false),
    ];
    const out = incidentsFrom(checks);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ service: 'jobs', endedAt: null, failedChecks: 1 });
    expect(out[1]).toMatchObject({ service: 'email', startedAt: '2026-10-02T00:00:00Z', endedAt: '2026-10-02T02:00:00Z', failedChecks: 2 });
  });
});

describe('service meta', () => {
  const env = {
    EMAIL_PROVIDER: 'ses',
    SES_FROM_EMAIL: 'SBC <noreply@sbcllp.in>',
    RESEND_API_KEY: 're_secret_value',
    EUM_PHONE_NUMBER_ID: 'phone-number-id-1234abcd',
    AZURE_AD_TENANT_ID: 'tenant-0000-9999',
    AZURE_AD_CLIENT_SECRET: 'azure-secret-value',
    S3_BUCKET: 'vcfo-documents',
    S3_REGION: 'ap-south-1',
    APP_RUNNER_SERVICE_ARN: 'arn:aws:apprunner:ap-south-1:600627321277:service/vcfo-suite/abc',
  };

  it('reads accounts and endpoints, keeps ids short and never returns a secret', () => {
    const meta = serviceMeta(readServiceConfig(env), env, '2026-11-01T00:00:00Z');
    const by = Object.fromEntries(meta.map((m) => [m.id, m]));
    expect(by.email.account).toBe('noreply@sbcllp.in');
    expect(by.email.endpoint).toBe('email.ap-south-1.amazonaws.com');
    expect(by.whatsapp.account).toBe('Phone …abcd');
    expect(by.outlook.account).toBe('Tenant …9999');
    expect(by.outlook.authExpires).toBe('2026-11-01T00:00:00Z');
    expect(by.storage.account).toBe('vcfo-documents');
    expect(by.deploys.account).toBe('vcfo-suite');
    expect(by.costs.checkable).toBe(false);
    expect(JSON.stringify(meta)).not.toMatch(/re_secret_value|azure-secret-value/);
  });

  it('reads the mail domain from the from address', () => {
    expect(mailDomain({ EMAIL_FROM: 'a@Example.COM' })).toBe('example.com');
    expect(mailDomain({})).toBeNull();
    expect(tail4('ab')).toBe('ab');
  });
});

describe('secrets and accounts', () => {
  const svc: DeployService = {
    name: 'vcfo-suite',
    url: null,
    status: 'RUNNING',
    image: 'latest',
    cpu: null,
    memory: null,
    updatedAt: null,
    instanceRole: 'arn:aws:iam::1:role/vcfo-app',
    secretNames: ['AUTH_SECRET'],
    envNames: ['RESEND_API_KEY'],
  };

  it('says where each secret is stored and never carries a value', () => {
    const rows = secretInventory({ DB_SECRET_ARN: 'arn:aws:secretsmanager:ap-south-1:1:secret:rds!db-1' }, svc);
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by.AUTH_SECRET).toMatchObject({ storedIn: 'Secrets Manager', set: true });
    expect(by.RESEND_API_KEY).toMatchObject({ storedIn: 'App Runner env', set: true });
    expect(by.DB_SECRET_ARN).toMatchObject({ storedIn: 'Secrets Manager', set: true });
    expect(by.DATABASE_URL).toBeUndefined();
    expect(by.ANTHROPIC_API_KEY).toMatchObject({ storedIn: 'Not set', set: false });
    expect(JSON.stringify(rows)).not.toContain('pw@host');
  });

  it('lists the role the app runs as and the apps it signs in with', () => {
    const rows = serviceAccounts({ INNGEST_SIGNING_KEY: 'k', AZURE_AD_CLIENT_ID: 'client-1234' }, svc, { deploys: check('deploys', '2026-10-01T00:00:00Z', true) });
    expect(rows.map((r) => r.account)).toEqual(['vcfo-app', 'vcfo-suite', 'App …1234']);
    expect(rows[0].lastUsed).toBe('2026-10-01T00:00:00Z');
  });
});

describe('flags, commits and run now', () => {
  it('reads the env switches', () => {
    const flags = featureFlags({ WHATSAPP_ENABLED: 'true', EMAIL_PROVIDER: 'resend' });
    expect(flags.find((f) => f.id === 'WHATSAPP_ENABLED')?.on).toBe(true);
    expect(flags.find((f) => f.id === 'EMAIL_PROVIDER')?.on).toBe(false);
  });

  it('reads a commit only from a hex tag', () => {
    expect(commitOf('repo:4f2a9c1d0b7e88')).toBe('4f2a9c1d0b7e');
    expect(commitOf('repo:latest')).toBeNull();
    expect(commitOf('repo@sha256:4f2a9c1d0b7e8899')).toBeNull();
  });

  it('finds the dev/run trigger and keeps the schedule as the trigger', () => {
    const fn = { id: () => 'compliance-reminders', opts: { triggers: [{ cron: '0 3 * * *' }, { event: runNowEvent('compliance-reminders') }] } };
    const [d] = describeFunctions([fn]);
    expect(d.trigger).toEqual({ kind: 'cron', cron: '0 3 * * *' });
    expect(d.runEvent).toBe('dev/run.compliance-reminders');
    const [plain] = describeFunctions([{ id: () => 'x', opts: { triggers: { event: 'a/b' } } }]);
    expect(plain.runEvent).toBeNull();
  });
});
