import { describe, expect, it } from 'vitest';
import { maskAddress, maskEmail, maskPhone, scrubText } from './mask';
import { readServiceConfig } from './env-status';
import { actionLabel, isDevAuditEvent } from './audit-actions';
import { cronWords, describeFunctions, functionForEvent, logFilterPattern, logLevelOf, runsForEvent, sumCostsByService } from './parse';
import { bytes, day, duration, stamp } from './format';
import { reach } from './reach';

describe('mask', () => {
  it('keeps the first letter and the domain of an email', () => {
    expect(maskEmail('Rahul@Acme.IN')).toBe('R•••@acme.in');
    expect(maskEmail('bad')).toBe('•••');
    expect(maskEmail('')).toBe('');
  });

  it('keeps the country code and last two digits of a phone', () => {
    expect(maskPhone('+919876543210')).toBe('+91•••10');
    expect(maskPhone('9876543210')).toBe('•••10');
    expect(maskPhone('123')).toBe('•••');
    expect(maskAddress('x@y.co')).toBe('x•••@y.co');
    expect(maskAddress('+14155550100')).toBe('+1•••00');
  });

  it('scrubs emails, phones and PANs from free text', () => {
    const out = scrubText('Sent to priya@northwind.in and +91 98765 43210 for ABCDE1234F');
    expect(out).toBe('Sent to p•••@northwind.in and +91•••10 for AB•••');
  });
});

describe('readServiceConfig', () => {
  it('reports names only, never values', () => {
    const env = {
      EMAIL_PROVIDER: 'ses',
      SES_FROM_EMAIL: 'no-reply@sbcllp.in',
      S3_BUCKET: 'vcfo-docs',
      S3_REGION: 'ap-south-1',
      INNGEST_SIGNING_KEY: 'signkey-prod-secret',
      ASK_VCFO_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'sk-ant-secret',
      AWS_COST_EXPLORER: 'on',
    };
    const all = readServiceConfig(env);
    const text = JSON.stringify(all);
    for (const v of ['no-reply@sbcllp.in', 'vcfo-docs', 'signkey-prod-secret', 'sk-ant-secret']) expect(text).not.toContain(v);
    const by = Object.fromEntries(all.map((s) => [s.id, s]));
    expect(by.email).toMatchObject({ provider: 'Amazon SES', status: 'configured' });
    expect(by.whatsapp.status).toBe('off');
    expect(by.storage.status).toBe('configured');
    expect(by.jobs.status).toBe('configured');
    expect(by.ask).toMatchObject({ provider: 'Anthropic API', status: 'configured' });
    expect(by.credentials).toMatchObject({ status: 'off', missing: ['CREDENTIALS_ENCRYPTION_KEY'] });
    expect(by.logs.status).toBe('off');
    expect(by.costs.status).toBe('configured');
  });

  it('marks a half-set service as partial', () => {
    const by = Object.fromEntries(readServiceConfig({ S3_BUCKET: 'b' }).map((s) => [s.id, s]));
    expect(by.storage).toMatchObject({ status: 'partial', missing: ['S3_REGION'] });
    expect(by.email).toMatchObject({ provider: 'Resend', status: 'off' });
  });
});

describe('audit actions', () => {
  it('keeps system and access actions and any failed or denied result', () => {
    expect(isDevAuditEvent('system.compliance_overdue', 'ok')).toBe(true);
    expect(isDevAuditEvent('account.delete', 'ok')).toBe(true);
    expect(isDevAuditEvent('checklist.deliver', 'ok')).toBe(false);
    expect(isDevAuditEvent('checklist.deliver', 'denied')).toBe(true);
    expect(actionLabel('two_step.enable')).toBe('Two step enable');
  });
});

describe('parse', () => {
  it('reads the level of a log line', () => {
    expect(logLevelOf('{"level":"error","msg":"x"}')).toBe('error');
    expect(logLevelOf('{"level":30,"msg":"x"}')).toBe('info');
    expect(logLevelOf('[audit] record threw Error: db down')).toBe('error');
    expect(logLevelOf('Warning: something deprecated')).toBe('warn');
    expect(logLevelOf('GET /api/tasks 200 in 31ms')).toBe('info');
  });

  it('builds a safe filter pattern', () => {
    expect(logFilterPattern('')).toBeUndefined();
    expect(logFilterPattern('db "down" \\x')).toBe('"db" "down" "x"');
  });

  it('sums costs by service across months', () => {
    const out = sumCostsByService([
      { Groups: [{ Keys: ['Amazon RDS'], Metrics: { UnblendedCost: { Amount: '10.004', Unit: 'USD' } } }] },
      {
        Groups: [
          { Keys: ['Amazon RDS'], Metrics: { UnblendedCost: { Amount: '5', Unit: 'USD' } } },
          { Keys: ['AWS App Runner'], Metrics: { UnblendedCost: { Amount: '20.5', Unit: 'USD' } } },
          { Keys: ['Tax'], Metrics: { UnblendedCost: { Amount: '0.001', Unit: 'USD' } } },
        ],
      },
    ]);
    expect(out).toEqual({ currency: 'USD', total: 35.5, services: [{ service: 'AWS App Runner', amount: 20.5 }, { service: 'Amazon RDS', amount: 15 }] });
  });

  it('describes functions and maps runs to them without event data', () => {
    const fns = describeFunctions([
      { id: () => 'compliance-generate', opts: { triggers: [{ cron: '0 6 * * *' }] } },
      { id: () => 'whatsapp-send', opts: { retries: 3, triggers: [{ event: 'notify/whatsapp.send' }] } },
    ]);
    expect(fns[1]).toEqual({ id: 'whatsapp-send', name: 'whatsapp-send', trigger: { kind: 'event', event: 'notify/whatsapp.send' }, retries: 3 });
    expect(functionForEvent({ name: 'inngest/scheduled.timer', data: { cron: '0 6 * * *' } }, fns)).toBe('compliance-generate');
    const runs = runsForEvent(
      { internal_id: 'e1', name: 'notify/whatsapp.send', data: { cron: undefined } },
      [{ run_id: 'r1', status: 'Failed', run_started_at: '2026-10-28T01:00:00Z', ended_at: null }],
      fns,
    );
    expect(runs).toEqual([{ id: 'r1', functionId: 'whatsapp-send', event: 'notify/whatsapp.send', status: 'Failed', startedAt: '2026-10-28T01:00:00Z', endedAt: null }]);
    expect(cronWords('TZ=Asia/Kolkata 0 6 * * *')).toBe('Daily at 06:00 IST');
    expect(cronWords('0 7 * * *')).toBe('Daily at 07:00 UTC');
  });
});

describe('format', () => {
  const now = new Date('2026-10-29T06:00:00Z');
  it('writes plain dates in India time', () => {
    expect(day('2026-10-14T20:00:00Z', now)).toBe('15 Oct');
    expect(day('2025-03-01T06:00:00Z', now)).toBe('1 Mar 2025');
    expect(stamp('2026-10-14T03:42:00Z', now)).toBe('14 Oct, 09:12');
    expect(day(null)).toBe('-');
  });

  it('writes durations and sizes', () => {
    expect(duration('2026-10-14T03:42:00Z', '2026-10-14T03:43:20Z')).toBe('1 min 20 s');
    expect(duration('2026-10-14T03:42:00Z', null)).toBe('-');
    expect(bytes(0)).toBe('0 B');
    expect(bytes(2516582)).toBe('2.4 MB');
  });
});

describe('reach', () => {
  it('turns a failure into the unreachable state', async () => {
    const out = await reach(async () => {
      throw new Error('denied for a@b.co');
    });
    expect(out).toEqual({ state: 'unreachable', error: 'denied for a•••@b.co' });
  });

  it('times out', async () => {
    const out = await reach(() => new Promise(() => {}), 20);
    expect(out.state).toBe('unreachable');
  });
});

describe('outlookHealth', () => {
  it('reads the refresh window from the last update', async () => {
    const { outlookHealth } = await import('./parse');
    const now = new Date('2026-10-29T00:00:00Z');
    expect(outlookHealth({ updatedAt: '2026-10-20T00:00:00Z' }, now)).toBe('Connected');
    expect(outlookHealth({ updatedAt: '2026-08-10T00:00:00Z' }, now)).toBe('Due soon');
    expect(outlookHealth({ updatedAt: '2026-07-01T00:00:00Z' }, now)).toBe('Needs re-auth');
  });
});
