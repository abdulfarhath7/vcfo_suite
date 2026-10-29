import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readServiceConfig } from '@/lib/dev/env-status';
import { outlookHealth } from '@/lib/dev/parse';
import { registeredJobs } from '@/lib/dev/jobs-registry';
import { listInngestRuns } from '@/lib/dev/inngest';
import { readAppRunner } from '@/lib/dev/aws';
import { listOutlookConnectionsForDev } from '@/db/repositories/dev-connections';
import { messageCounts24h } from '@/db/repositories/dev-messages';
import { countAuditProblemsForDev } from '@/db/repositories/dev-audit';
import { countSignedInStaffForDev } from '@/db/repositories/dev-access';
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
 * and (when set up) Inngest runs today and the latest App Runner operation. Each outside call
 * has its own timeout, so one slow service only greys out its own tile. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, z.object({}), async (ctx): Promise<OverviewPayload> => {
    const functions = registeredJobs();
    const [outlook, messages, audit7d, staffSignedIn, runs, appRunner] = await Promise.all([
      listOutlookConnectionsForDev(ctx),
      messageCounts24h(ctx),
      countAuditProblemsForDev(ctx, 7),
      countSignedInStaffForDev(ctx),
      listInngestRuns(functions, 1),
      readAppRunner(),
    ]);
    const today = startOfIstDay();
    return {
      services: readServiceConfig(),
      outlook: { connected: outlook.length, expiringSoon: outlook.filter((o) => outlookHealth(o) !== 'Connected').length },
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
        latest: ops[0] ?? null,
      })),
    };
  });
}
