import { inngest } from '@/jobs/client';
import { withRunNow } from '@/jobs/dev-controls';
import { probeFor, runProbe } from '@/lib/dev/checks';
import { readServiceConfig } from '@/lib/dev/env-status';
import { systemRecordServiceCheck } from '@/db/repositories/dev-checks';

/**
 * Scheduled: every 5 minutes, one read-only live check of each outside service that is set up
 * (the same probes as "Test" on Connections), stored with no person ("System"). Uptime, p95,
 * incidents and "Last check" on the developer console read these rows. It sends nothing to
 * anyone, so "Pause all jobs" does not stop it. Cost Explorer is never probed (AWS bills it).
 *
 * Registered in app/api/inngest/route.ts.
 */
export const SERVICE_CHECKS_CRON = '*/5 * * * *';

export async function runServiceChecks(env: Record<string, string | undefined> = process.env): Promise<{ checked: number; failed: number }> {
  let checked = 0;
  let failed = 0;
  for (const svc of readServiceConfig(env)) {
    if (svc.status === 'off') continue;
    const probe = probeFor(svc.id, env);
    if (!probe) continue;
    const out = await runProbe(probe);
    await systemRecordServiceCheck({ service: svc.id, ...out });
    checked += 1;
    if (!out.ok) failed += 1;
  }
  return { checked, failed };
}

export const serviceChecks = inngest.createFunction(
  { id: 'service-checks', retries: 0 },
  withRunNow('service-checks', SERVICE_CHECKS_CRON),
  async ({ step }) => step.run('check-services', () => runServiceChecks()),
);
