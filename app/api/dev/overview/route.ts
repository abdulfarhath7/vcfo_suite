import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { missingSecrets, readServiceConfig } from '@/lib/dev/env-status';
import { outlookHealth } from '@/lib/dev/parse';
import { registeredJobs } from '@/lib/dev/jobs-registry';
import { listInngestRuns } from '@/lib/dev/inngest';
import { countLogErrors24h, readAppRunner, readCostsThisMonth } from '@/lib/dev/aws';
import { listOutlookConnectionsForDev } from '@/db/repositories/dev-connections';
import { messageCounts24h } from '@/db/repositories/dev-messages';
import { countAuditProblemsForDev } from '@/db/repositories/dev-audit';
import { countDemoLoginsForDev, countSignedInStaffForDev } from '@/db/repositories/dev-access';
import { listServiceChecksForDev } from '@/db/repositories/dev-checks';
import { lastDeployActorForDev } from '@/db/repositories/dev-deploys';
import { healthByService, incidentsFrom } from '@/lib/dev/health';
import { commitOf, imageVersion } from '@/lib/dev/format';
import type { OverviewPayload, Reach } from '@/lib/dev/types';

function mapReach<T, U>(r: Reach<T>, f: (d: T) => U): Reach<U> {
  return r.state === 'ok' ? { state: 'ok', data: f(r.data) } : r;
}

/** Start of today in India time, as a UTC instant. */
function startOfIstDay(now = new Date()): number {
  const ist = new Date(now.getTime() + 5.5 * 3600000);
  ist.setUTCHours(0, 0, 0, 0);
  return ist.getTime() - 5.5 * 3600000;
}

/**
 * GET /api/dev/overview: the console home in one call. Services from env presence, Outlook
 * links, messages in 24 hours, failed and denied audit events in 7 days, open staff sessions,
 * secrets to fix (env names and seeded demo logins), and (when set up) Inngest runs today,
 * App Runner operations, error lines in the log for 24 hours and this month's spend. Uptime,
 * p95 and incidents come from the stored live checks of the last 30 days. Each
 * outside call has its own timeout, so one slow service only greys out its own tile.
 * Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<OverviewPayload> => {
    const functions = registeredJobs();
    const [outlook, messages, audit7d, staffSignedIn, demoLogins, runs, appRunner, errors24h, costsMonth, checks, lastBy] = await Promise.all([
      listOutlookConnectionsForDev(ctx),
      messageCounts24h(ctx),
      countAuditProblemsForDev(ctx, 7),
      countSignedInStaffForDev(ctx),
      countDemoLoginsForDev(ctx),
      listInngestRuns(functions, 1),
      readAppRunner(),
      countLogErrors24h(),
      readCostsThisMonth(),
      listServiceChecksForDev(ctx, { days: 30 }),
      lastDeployActorForDev(ctx),
    ]);
    const today = startOfIstDay();
    const services = readServiceConfig();
    return {
      services,
      outlook: {
        connected: outlook.length,
        expiringSoon: outlook.filter((o) => outlookHealth(o) !== 'Connected').length,
        healthy: outlook.filter((o) => outlookHealth(o) === 'Connected').length,
      },
      secrets: { missing: missingSecrets(process.env, services), demoLogins },
      errors24h,
      costsMonth,
      messages,
      audit7d,
      staffSignedIn,
      jobs: mapReach(runs, (list) => ({
        failedToday: list.filter((r) => r.status === 'Failed' && r.startedAt && new Date(r.startedAt).getTime() >= today).length,
        runningNow: list.filter((r) => r.status === 'Running').length,
        lastRuns: list.slice(0, 5),
      })),
      deploy: mapReach(appRunner.operations, (ops) => ({
        status: appRunner.service.state === 'ok' ? appRunner.service.data.status : 'UNKNOWN',
        image: appRunner.service.state === 'ok' ? appRunner.service.data.image : null,
        latest: ops[0] ?? null,
        recent: ops.slice(0, 5),
      })),
      health: healthByService(services.map((s) => s.id), checks),
      incidents: incidentsFrom(checks).slice(0, 8),
      environment: mapReach(appRunner.service, (svc) => ({
        name: 'Production',
        address: svc.url,
        version: imageVersion(svc.image),
        commit: commitOf(svc.image),
        deployedAt: svc.updatedAt,
        by: lastBy?.name ?? null,
      })),
    };
  });
}
