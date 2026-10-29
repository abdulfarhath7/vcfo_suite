import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readInngestRun } from '@/lib/dev/inngest';
import { readLogLines } from '@/lib/dev/aws';
import type { JobRunDetail } from '@/lib/dev/types';

const Query = z.object({
  runId: z.string().min(1).max(120),
  functionId: z.string().max(120).optional(),
  start: z.string().datetime().optional(),
});

/**
 * GET /api/dev/jobs/run-detail: the "Run log" panel. The run as Inngest reports it, and the
 * app log lines that name the job's id from the hours around its start (CloudWatch, when
 * APP_LOG_GROUP is set). Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, Query, async (_ctx, q): Promise<JobRunDetail> => {
    const hoursAgo = q.start ? Math.ceil((Date.now() - new Date(q.start).getTime()) / 3600000) + 1 : 6;
    const [run, lines] = await Promise.all([
      readInngestRun(q.runId),
      q.functionId ? readLogLines({ text: q.functionId, hours: Math.min(Math.max(hoursAgo, 1), 72), limit: 200 }) : Promise.resolve({ state: 'ok' as const, data: [] }),
    ]);
    const from = q.start ? new Date(q.start).getTime() - 60000 : 0;
    return {
      run,
      lines: lines.state === 'ok' ? { state: 'ok', data: lines.data.filter((l) => new Date(l.at).getTime() >= from).slice(0, 100) } : lines,
    };
  });
}
