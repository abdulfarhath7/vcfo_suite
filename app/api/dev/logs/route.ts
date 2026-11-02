import { z } from 'zod';
import { devRoute } from '@/lib/dev/route-helpers';
import { readLogLines } from '@/lib/dev/aws';
import type { LogsPayload } from '@/lib/dev/types';

const Query = z.object({
  level: z.enum(['all', 'error', 'warn', 'info']).optional(),
  q: z.string().max(120).optional(),
  hours: z.coerce.number().int().min(1).max(72).optional(),
});

/**
 * GET /api/dev/logs: CloudWatch log lines from the group in APP_LOG_GROUP, newest first, with
 * a level and text filter. Emails and phone numbers in the text are masked. Developer or super admin.
 */
export async function GET(request: Request) {
  return devRoute(request, Query, async (_ctx, q): Promise<LogsPayload> => ({
    group: process.env.APP_LOG_GROUP?.trim() || null,
    lines: await readLogLines({ level: q.level ?? 'all', text: q.q, hours: q.hours }),
  }));
}
