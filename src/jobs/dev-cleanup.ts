import { inngest } from '@/jobs/client';
import { PAUSED, skipWhenPaused, withRunNow } from '@/jobs/dev-controls';
import { systemPurgeFailedEmails } from '@/db/repositories/failed-emails';
import { systemPurgeExportFiles } from '@/db/repositories/export-files';
import { deleteObject } from '@/storage/s3';

/**
 * Scheduled, daily 03:00 IST: removes failed mail kept for retry and export copies older than
 * 30 days (rows and their `exports/` objects in S3). It honours "Pause all jobs".
 *
 * Registered in app/api/inngest/route.ts.
 */
export const DEV_CLEANUP_CRON = 'TZ=Asia/Kolkata 0 3 * * *';

export async function runDevCleanup(now = new Date()): Promise<{ failedEmails: number; exports: number; objectsFailed: number }> {
  const failedEmails = await systemPurgeFailedEmails(now);
  const keys = await systemPurgeExportFiles(now);
  let objectsFailed = 0;
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch {
      objectsFailed += 1;
    }
  }
  return { failedEmails, exports: keys.length, objectsFailed };
}

export const devCleanup = inngest.createFunction(
  { id: 'dev-cleanup', retries: 2 },
  withRunNow('dev-cleanup', DEV_CLEANUP_CRON),
  async ({ step }) => {
    if (await skipWhenPaused(step)) return PAUSED;
    return step.run('purge-old-rows', () => runDevCleanup());
  },
);
