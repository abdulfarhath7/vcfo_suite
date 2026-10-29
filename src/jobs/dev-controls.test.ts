import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Developer console controls in the jobs: every cron job takes the `dev/run.<id>` trigger
 * ("Run now", P-331); the reminder, digest, alert and mail jobs stop before any work while
 * "Pause all jobs" is on (P-335); the service-checks job stores one system check per service.
 * The database and every outside call are mocked.
 */

const paused = vi.fn(async () => false);
const recorded: Array<Record<string, unknown>> = [];

vi.mock('@/db/client', async () => (await import('@/db/repositories/dev-test-db')).mockDbModule);
vi.mock('@/db/repositories/dev-settings', () => ({ systemJobsPaused: () => paused() }));
vi.mock('@/db/repositories/dev-checks', () => ({
  systemRecordServiceCheck: async (row: Record<string, unknown>) => {
    recorded.push(row);
  },
}));

const { withRunNow, skipWhenPaused, PAUSED } = await import('./dev-controls');
const { registeredJobs } = await import('@/lib/dev/jobs-registry');
const jobs = {
  complianceReminders: (await import('./compliance-reminders')).complianceReminders,
  dailyDigest: (await import('./daily-digest')).dailyDigest,
  weeklyDigest: (await import('./weekly-digest')).weeklyDigest,
  savedReportsSend: (await import('./saved-reports-send')).savedReportsSend,
  staffAlerts: (await import('./staff-alerts')).staffAlerts,
  whatsappSend: (await import('./whatsapp-send')).whatsappSend,
};
const { runServiceChecks } = await import('./service-checks');

/** A step that runs each callback at once and remembers the step names. */
function fakeStep() {
  const names: string[] = [];
  return {
    names,
    run: async <T,>(name: string, fn: () => Promise<T>) => {
      names.push(name);
      return fn();
    },
    sendEvent: async () => ({ ids: [] }),
    sleep: async () => undefined,
  };
}

beforeEach(() => {
  paused.mockReset();
  paused.mockResolvedValue(false);
  recorded.length = 0;
});

describe('run now', () => {
  it('pairs a cron with its dev/run event', () => {
    expect(withRunNow('x', '0 7 * * *')).toEqual([{ cron: '0 7 * * *' }, { event: 'dev/run.x' }]);
  });

  it('gives every registered cron job a run event, and no event job one', () => {
    for (const f of registeredJobs()) {
      if (f.trigger.kind === 'cron') expect(f.runEvent, f.id).toBe(`dev/run.${f.id}`);
      else expect(f.runEvent, f.id).toBeNull();
    }
    expect(registeredJobs().map((f) => f.id)).toContain('service-checks');
  });
});

describe('pause all jobs', () => {
  it('reads the switch inside a step', async () => {
    const step = fakeStep();
    paused.mockResolvedValue(true);
    expect(await skipWhenPaused(step)).toBe(true);
    expect(step.names).toEqual(['check-paused']);
  });

  it.each(Object.keys(jobs) as Array<keyof typeof jobs>)('%s returns before any work while paused', async (key) => {
    paused.mockResolvedValue(true);
    const step = fakeStep();
    const handler = (jobs[key] as unknown as { fn: (ctx: unknown) => Promise<unknown> }).fn;
    const out = await handler({ step, event: { name: 'x', data: {} }, logger: console });
    expect(out).toEqual(PAUSED);
    expect(step.names).toEqual(['check-paused']);
  });
});

describe('service checks', () => {
  it('stores one system check per set-up service with a probe, and skips the rest', async () => {
    const out = await runServiceChecks({ CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(64), AWS_COST_EXPLORER: 'on' });
    expect(out).toEqual({ checked: 1, failed: 0 });
    expect(recorded).toEqual([{ service: 'credentials', ok: true, latencyMs: expect.any(Number), detail: 'Key is 32 bytes' }]);
  });

  it('counts a failed probe', async () => {
    const out = await runServiceChecks({ CREDENTIALS_ENCRYPTION_KEY: 'short' });
    expect(out).toEqual({ checked: 1, failed: 1 });
    expect(recorded[0]).toMatchObject({ service: 'credentials', ok: false });
  });
});
