import { Inngest } from 'inngest';

/**
 * Inngest — durable, retryable background + scheduled jobs.
 * Replaces the localStorage compliance-store and gives the compliance
 * calendar a real scheduler. Runs locally via `npm run inngest:dev`.
 */
export const inngest = new Inngest({ id: 'vcfo-suite' });
