import { runNowEvent } from '@/lib/dev/parse';
import { systemJobsPaused } from '@/db/repositories/dev-settings';

/**
 * Developer console controls shared by the jobs.
 *
 * `withRunNow` gives a cron job a second trigger, `dev/run.<id>`, so "Run now" on the Jobs page
 * can start it once (POST /api/dev/jobs/run). `skipWhenPaused` reads "Pause all jobs" inside
 * a step, so a retry sees the same answer; a job that sends reminders, digests, alerts or
 * mail returns `{ skipped: 'paused' }` when it is on.
 */

export function withRunNow(id: string, cron: string): [{ cron: string }, { event: string }] {
  return [{ cron }, { event: runNowEvent(id) }];
}

type StepLike = { run: <T>(name: string, fn: () => Promise<T>) => Promise<unknown> };

export const PAUSED = { skipped: 'paused' } as const;

/** True when "Pause all jobs" is on. Read in its own step. */
export async function skipWhenPaused(step: StepLike): Promise<boolean> {
  return (await step.run('check-paused', () => systemJobsPaused())) === true;
}
